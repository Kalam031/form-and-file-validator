using System.Text.Json;
using Xunit;

namespace FormAndFileValidator.Tests;

/// <summary>PhotoPrivacy must produce, byte for byte, what the JavaScript stripMetadata produced for spec/metadata-vectors.json.</summary>
public class MetadataTests
{
    static MetadataOptions ToOptions(JsonElement o)
    {
        var m = new MetadataOptions();
        if (o.TryGetProperty("keepOrientation", out var a)) m.KeepOrientation = a.GetBoolean();
        if (o.TryGetProperty("keepColorProfile", out var b)) m.KeepColorProfile = b.GetBoolean();
        return m;
    }

    static string Describe(PhotoMetadata? m) => m == null ? "null" : $"{m.Format} exif={m.Exif} gps={m.Gps} xmp={m.Xmp} iptc={m.Iptc} comments={m.Comments} ori={m.Orientation} [{string.Join(",", m.Kinds)}]";

    static string Describe(JsonElement e)
    {
        if (e.ValueKind == JsonValueKind.Null) return "null";
        string kinds = string.Join(",", e.GetProperty("kinds").EnumerateArray().Select(k => k.GetString()));
        string ori = e.GetProperty("orientation").ValueKind == JsonValueKind.Null ? "" : e.GetProperty("orientation").GetInt32().ToString();
        return $"{e.GetProperty("format").GetString()} exif={Cap(e, "exif")} gps={Cap(e, "gps")} xmp={Cap(e, "xmp")} iptc={Cap(e, "iptc")} comments={Cap(e, "comments")} ori={ori} [{kinds}]";
    }

    static string Cap(JsonElement e, string name) => e.GetProperty(name).GetBoolean() ? "True" : "False";

    [Fact]
    public void Every_vector_reads_and_strips_exactly_like_JavaScript()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "metadata-vectors.json")));
        var cases = doc.RootElement.GetProperty("cases").EnumerateArray().ToList();
        Assert.True(cases.Count >= 25);
        var mismatches = new List<string>();
        foreach (var c in cases)
        {
            string id = c.GetProperty("id").GetString()!;
            var data = Convert.FromBase64String(c.GetProperty("base64").GetString()!);
            var options = ToOptions(c.GetProperty("options"));

            string wantBefore = Describe(c.GetProperty("before")), gotBefore = Describe(PhotoPrivacy.Read(data, options));
            if (wantBefore != gotBefore) { mismatches.Add($"{id}: read\n    js:   {wantBefore}\n    .net: {gotBefore}"); continue; }

            var r = PhotoPrivacy.Strip(data, options);
            bool wantChanged = c.GetProperty("changed").GetBoolean();
            if (r.Changed != wantChanged) { mismatches.Add($"{id}: changed expected {wantChanged}"); continue; }
            if (!wantChanged) { if (!r.Data.SequenceEqual(data)) mismatches.Add($"{id}: unchanged file must keep its bytes"); continue; }

            var want = Convert.FromBase64String(c.GetProperty("output").GetString()!);
            if (!r.Data.SequenceEqual(want)) { mismatches.Add($"{id}: output bytes differ (js {want.Length}, .net {r.Data.Length})"); continue; }
            var wantRemoved = c.GetProperty("removed").EnumerateArray().Select(x => x.GetString()).ToList();
            if (!wantRemoved.SequenceEqual(r.Removed)) mismatches.Add($"{id}: removed [{string.Join(",", r.Removed)}] expected [{string.Join(",", wantRemoved)}]");
            string wantAfter = Describe(c.GetProperty("after")), gotAfter = Describe(PhotoPrivacy.Read(r.Data, options));
            if (wantAfter != gotAfter) mismatches.Add($"{id}: read after\n    js:   {wantAfter}\n    .net: {gotAfter}");
        }
        Assert.True(mismatches.Count == 0, $"{mismatches.Count} of {cases.Count} vectors differ from JavaScript:\n" + string.Join("\n", mismatches.Take(30)));
    }

    [Fact]
    public void An_uploaded_file_keeps_its_name_type_and_path_and_a_clean_one_is_returned_as_it_is()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "metadata-vectors.json")));
        var withGps = doc.RootElement.GetProperty("cases").EnumerateArray().First(c => c.GetProperty("id").GetString() == "jpeg: exif orientation 6 and gps");
        var file = new UploadedFile("trip.jpg", "image/jpeg", Convert.FromBase64String(withGps.GetProperty("base64").GetString()!).Length,
            () => new MemoryStream(Convert.FromBase64String(withGps.GetProperty("base64").GetString()!), false)) { Path = "trip/day1/trip.jpg" };

        Assert.True(PhotoPrivacy.Read(file)!.Gps);
        var clean = PhotoPrivacy.Strip(file);
        Assert.NotSame(file, clean);
        Assert.Equal(("trip.jpg", "image/jpeg", "trip/day1/trip.jpg"), (clean.Name, clean.ContentType, clean.Path));
        Assert.True(clean.Length < file.Length);
        Assert.False(PhotoPrivacy.Read(clean)!.Gps);
        Assert.Equal(6, PhotoPrivacy.Read(clean)!.Orientation);
        var again = PhotoPrivacy.Strip(clean);                                                          // a second pass changes nothing
        Assert.Equal(clean.ReadRange(0, clean.Length), again.ReadRange(0, again.Length));

        var text = UploadedFile.FromBytes("a.txt", "text/plain", new byte[] { 65, 66 });
        Assert.Same(text, PhotoPrivacy.Strip(text));
        Assert.Null(PhotoPrivacy.Read(text));
    }

    [Fact]
    public void The_stripped_file_still_passes_FileValidator()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "metadata-vectors.json")));
        var c = doc.RootElement.GetProperty("cases").EnumerateArray().First(x => x.GetProperty("id").GetString() == "jpeg: everything");
        var clean = PhotoPrivacy.Strip(UploadedFile.FromBytes("a.jpg", "image/jpeg", Convert.FromBase64String(c.GetProperty("base64").GetString()!)));
        var r = FileValidator.ValidateFile(clean, new FileValidatorOptions { AllowedExtensions = { "jpg" }, ValidateImageDecode = false });
        Assert.True(r.IsValid, string.Join(" ", r.Issues.Select(i => i.Code)));
    }
}
