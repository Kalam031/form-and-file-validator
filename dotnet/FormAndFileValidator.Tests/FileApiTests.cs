using System.ComponentModel.DataAnnotations;
using System.Text;
using Xunit;

namespace FormAndFileValidator.Tests;

public class FileApiTests
{
    // shapes of the framework objects, without referencing the frameworks
    sealed class FakeFormFile    // ASP.NET Core IFormFile
    {
        readonly byte[] _data;
        public FakeFormFile(string name, string type, byte[] data) { FileName = name; ContentType = type; _data = data; }
        public string FileName { get; }
        public string ContentType { get; }
        public long Length => _data.Length;
        public Stream OpenReadStream() => new MemoryStream(_data, false);
    }

    sealed class FakePostedFile  // ASP.NET MVC 5 HttpPostedFileBase
    {
        public FakePostedFile(string name, string type, byte[] data) { FileName = name; ContentType = type; InputStream = new MemoryStream(data, false); ContentLength = data.Length; }
        public string FileName { get; }
        public string ContentType { get; }
        public int ContentLength { get; }
        public Stream InputStream { get; }
    }

    static byte[] Png(int w, int h)
    {
        var ms = new MemoryStream();
        ms.Write(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13 }, 0, 12);
        ms.Write(Encoding.ASCII.GetBytes("IHDR"), 0, 4);
        foreach (int n in new[] { w, h }) ms.Write(new[] { (byte)(n >> 24), (byte)(n >> 16), (byte)(n >> 8), (byte)n }, 0, 4);
        ms.Write(new byte[] { 8, 2, 0, 0, 0, 0, 0, 0, 0 }, 0, 9);
        return ms.ToArray();
    }

    static byte[] Text(string s) => Encoding.UTF8.GetBytes(s);

    [Fact]
    public void An_ASP_NET_Core_IFormFile_shaped_object_is_wrapped_and_validated()
    {
        var r = FileValidator.ValidateRaw(new FakeFormFile("a.exe", "application/octet-stream", Text("x")));
        Assert.False(r.IsValid);
        Assert.Contains("DANGEROUS_FILE_TYPE", r.Errors);
        Assert.True(FileValidator.ValidateRaw(new FakeFormFile("a.txt", "text/plain", Text("hello"))).IsValid);
    }

    [Fact]
    public void An_MVC5_HttpPostedFileBase_shaped_object_is_wrapped_and_a_list_is_validated_as_a_selection()
    {
        var files = new object[] { new FakePostedFile("a.txt", "text/plain", Text("one")), new FakePostedFile("b.txt", "text/plain", Text("two")), null! };
        Assert.True(FileValidator.ValidateRaw(files).IsValid);
        var r = FileValidator.ValidateRaw(files, new FileValidatorOptions { MaxFiles = 1 });
        Assert.Equal(new[] { "TOO_MANY_FILES" }, r.Errors);
        Assert.Equal("Please select no more than 1 file(s).", r.Issues[0].Message);
        Assert.Null(r.Issues[0].FileName);
    }

    [Fact]
    public void Something_that_is_not_a_file_is_refused_with_a_clear_message()
    {
        var e = Assert.Throws<ArgumentException>(() => UploadedFile.From(new object()));
        Assert.Contains("Not an uploaded file", e.Message);
        Assert.Empty(UploadedFile.FromMany(null));
        Assert.Empty(UploadedFile.FromMany("text is not a file list"));
    }

    [Fact]
    public void FromStream_can_be_read_again_for_every_check_and_is_not_closed()
    {
        var ms = new MemoryStream(Png(40, 30));
        var file = UploadedFile.FromStream("a.png", "image/png", ms);
        var r = FileValidator.Validate(new[] { file }, new FileValidatorOptions { AllowedExtensions = { "png" }, MaxImageWidth = 100 });
        Assert.True(r.IsValid);
        Assert.True(ms.CanRead);
    }

    [Fact]
    public void Image_sizes_are_read_from_the_header()
    {
        var o = new FileValidatorOptions { MaxImageWidth = 100, MaxImageHeight = 100, MinImageWidth = 10 };
        Assert.True(FileValidator.ValidateFile(UploadedFile.FromBytes("a.png", "image/png", Png(100, 100)), o).IsValid);
        var r = FileValidator.ValidateFile(UploadedFile.FromBytes("a.png", "image/png", Png(101, 5)), o);
        Assert.Equal(new[] { "WIDTH_EXCEEDED", "WIDTH_TOO_SMALL" }.Take(1).Concat(new[] { "WIDTH_EXCEEDED" }).Distinct(), r.Errors.Where(x => x == "WIDTH_EXCEEDED"));
        Assert.Equal("This image is 101px wide but the maximum is 100px.", r.Issues.First(i => i.Code == "WIDTH_EXCEEDED").Message);
    }

    [Fact]
    public void A_damaged_image_header_is_INVALID_IMAGE()
    {
        var broken = Png(10, 10); broken[12] = (byte)'X';       // IHDR spoiled
        var r = FileValidator.ValidateFile(UploadedFile.FromBytes("a.png", "image/png", broken));
        Assert.Equal(new[] { "INVALID_IMAGE" }, r.Errors);
        Assert.True(FileValidator.ValidateFile(UploadedFile.FromBytes("a.png", "image/png", broken), new FileValidatorOptions { ValidateImageDecode = false }).IsValid);
    }

    [Fact]
    public void A_scanner_sees_only_files_that_passed_everything_else_and_can_reject_or_fail()
    {
        int calls = 0;
        var opts = new FileValidatorOptions { Scan = f => { calls++; return f.Name.Contains("virus") ? ScanResult.Infected("EICAR") : ScanResult.Clean; } };
        Assert.True(FileValidator.ValidateFile(UploadedFile.FromBytes("a.txt", "text/plain", Text("fine")), opts).IsValid);
        var bad = FileValidator.ValidateFile(UploadedFile.FromBytes("virus.txt", "text/plain", Text("x")), opts);
        Assert.Equal(new[] { "MALWARE_DETECTED" }, bad.Errors);
        Assert.Equal("This file was flagged as EICAR and can't be uploaded.", bad.Issues[0].Message);
        FileValidator.ValidateFile(UploadedFile.FromBytes("a.exe", "", Text("x")), opts);   // rejected earlier: the scanner is not asked
        Assert.Equal(2, calls);

        var failing = new FileValidatorOptions { Scan = _ => throw new IOException("scanner down") };
        Assert.Equal(new[] { "SCAN_ERROR" }, FileValidator.ValidateFile(UploadedFile.FromBytes("a.txt", "text/plain", Text("x")), failing).Errors);
        failing.ScanFailOpen = true;
        Assert.True(FileValidator.ValidateFile(UploadedFile.FromBytes("a.txt", "text/plain", Text("x")), failing).IsValid);
    }

    [Fact]
    public void A_custom_check_gives_its_own_message()
    {
        var opts = new FileValidatorOptions { Custom = f => f.Length > 3 ? "Keep it short" : null };
        var r = FileValidator.ValidateFile(UploadedFile.FromBytes("a.txt", "text/plain", Text("long text")), opts);
        Assert.Equal(new[] { "CUSTOM" }, r.Errors);
        Assert.Equal("Keep it short", r.Issues[0].Message);
    }

    [Fact]
    public void Messages_can_be_replaced_and_summary_names_the_file()
    {
        var opts = new FileValidatorOptions { MaxFileSize = 1000, Messages = new Dictionary<string, string> { ["SIZE_TOO_LARGE"] = "Too big: {size} (limit {max})" } };
        var r = FileValidator.Validate(new[] { UploadedFile.FromBytes("big.txt", "text/plain", new byte[2000]) }, opts);
        Assert.Equal("big.txt: Too big: 2 KB (limit 1000 B)", r.Summary()[0]);
        Assert.Equal("Too big: 2 KB (limit 1000 B)", r.Summary(false)[0]);
    }

    [Fact]
    public void Accept_is_read_like_the_HTML_attribute_and_does_not_change_your_options()
    {
        var opts = new FileValidatorOptions { Accept = ".png,image/*" };
        Assert.True(FileValidator.ValidateFile(UploadedFile.FromBytes("a.png", "image/png", Png(5, 5)), opts).IsValid);
        Assert.Contains("INVALID_EXTENSION", FileValidator.ValidateFile(UploadedFile.FromBytes("a.gif", "image/gif", Encoding.ASCII.GetBytes("GIF89a\x01\x00\x01\x00")), opts).Errors);
        Assert.Empty(opts.AllowedExtensions);
    }

    [Fact]
    public void Dangerous_content_under_a_harmless_name_is_stopped()
    {
        var mz = new byte[128]; mz[0] = (byte)'M'; mz[1] = (byte)'Z'; mz[60] = 0x80;
        var r = FileValidator.ValidateFile(UploadedFile.FromBytes("holiday.jpg", "image/jpeg", mz));
        Assert.Equal(new[] { "DANGEROUS_CONTENT" }, r.Errors);
        Assert.Equal("This file contains exe, which can't be uploaded.", r.Issues[0].Message);
    }

    // ------------------------------------------------------------------ the attribute
    sealed class Profile
    {
        [FileRules(Extensions = "png,jpg", MaxSizeMB = 1, Required = true)]
        public object? Avatar { get; set; }

        [FileRules(Accept = "application/pdf", MaxFiles = 2)]
        public IEnumerable<object>? Documents { get; set; }
    }

    static IList<ValidationResult> Check(object model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), results, true);
        return results;
    }

    [Fact]
    public void The_FileRules_attribute_works_with_DataAnnotations_for_one_file_and_for_lists()
    {
        var ok = new Profile { Avatar = new FakeFormFile("me.png", "image/png", Png(10, 10)), Documents = null };
        Assert.Empty(Check(ok));

        var missing = Check(new Profile());
        Assert.Equal(new[] { "Avatar" }, missing.SelectMany(r => r.MemberNames).ToArray());
        Assert.Equal("Please select a file.", missing[0].ErrorMessage);

        var bad = Check(new Profile
        {
            Avatar = new FakeFormFile("me.gif", "image/gif", Text("GIF89a")),
            Documents = new object[] { new FakeFormFile("a.pdf", "application/pdf", Text("%PDF-1.4\n%%EOF\n")), new FakeFormFile("b.pdf", "application/pdf", Text("%PDF-1.4\n%%EOF\n")), new FakeFormFile("c.pdf", "application/pdf", Text("%PDF-1.4\n%%EOF\n")) }
        });
        Assert.Equal(new[] { "Avatar", "Documents" }, bad.SelectMany(r => r.MemberNames).OrderBy(x => x).ToArray());
        Assert.Contains("Please select no more than 2 file(s).", bad.First(r => r.MemberNames.Contains("Documents")).ErrorMessage);
    }

    [Fact]
    public void The_same_attributes_give_the_JSON_for_the_browser()
    {
        Assert.Equal("{\"Avatar\":{\"allowedExtensions\":[\"png\",\"jpg\"],\"maxFileSizeMB\":1},\"Documents\":{\"accept\":\"application/pdf\",\"maxFiles\":2,\"allowNoFiles\":true}}", ModelFileRules.ToJson<Profile>());
    }
}
