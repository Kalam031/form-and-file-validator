using System.Reflection;
using System.Text.Json;
using Xunit;

namespace FormAndFileValidator.Tests;

/// <summary>The .NET FileValidator must give the answers of spec/file-rules.vectors.json, which the JavaScript FileValidator produced.</summary>
public class FileConformanceTests
{
    private static JsonDocument Load() => JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "file-rules.vectors.json")));

    [Fact]
    public void Every_vector_gets_the_same_codes_and_messages_as_in_JavaScript()
    {
        using var doc = Load();
        var cases = doc.RootElement.GetProperty("cases").EnumerateArray().ToList();
        Assert.True(cases.Count > 150, "the vectors file should have more than 150 cases");

        var mismatches = new List<string>();
        foreach (var c in cases)
        {
            string id = c.GetProperty("id").GetString()!;
            var files = c.GetProperty("files").EnumerateArray().Select(f =>
                new UploadedFile(f.GetProperty("name").GetString(), f.GetProperty("type").GetString(), Convert.FromBase64String(f.GetProperty("base64").GetString()!).Length,
                    () => new MemoryStream(Convert.FromBase64String(f.GetProperty("base64").GetString()!), false)) { Path = f.GetProperty("path").GetString() ?? "" }).ToList();
            var options = ToOptions(c.GetProperty("config"));
            var expected = c.GetProperty("expected");

            FileValidationResult r;
            try { r = FileValidator.Validate(files, options); }
            catch (Exception e) { mismatches.Add($"{id}: threw {e.GetType().Name}: {e.Message}"); continue; }

            var wantErrors = expected.GetProperty("errors").EnumerateArray().Select(x => x.GetString()!).ToList();
            var wantGroup = expected.GetProperty("group").EnumerateArray().Select(x => x.GetString()!).ToList();
            var wantPerFile = expected.GetProperty("perFile").EnumerateArray().Select(a => a.EnumerateArray().Select(x => x.GetString()!).ToList()).ToList();
            var wantMessages = expected.GetProperty("messages").EnumerateArray().Select(x => x.GetString()!).ToList();

            var gotGroup = r.Issues.Where(i => i.FileName == null).Select(i => i.Code).ToList();
            var gotPerFile = r.Files.Select(f => f.Issues.Select(i => i.Code).ToList()).ToList();
            var gotMessages = r.Issues.Select(i => i.Message).ToList();

            if (r.IsValid != expected.GetProperty("valid").GetBoolean() || !wantErrors.SequenceEqual(r.Errors) || !wantGroup.SequenceEqual(gotGroup) ||
                wantPerFile.Count != gotPerFile.Count || wantPerFile.Zip(gotPerFile, (a, b) => a.SequenceEqual(b)).Any(x => !x))
                mismatches.Add($"{id}: expected [{string.Join(",", wantErrors)}] group [{string.Join(",", wantGroup)}] files [{string.Join(" | ", wantPerFile.Select(x => string.Join(",", x)))}], " +
                               $"got [{string.Join(",", r.Errors)}] group [{string.Join(",", gotGroup)}] files [{string.Join(" | ", gotPerFile.Select(x => string.Join(",", x)))}]");
            else if (!wantMessages.SequenceEqual(gotMessages))
                mismatches.Add($"{id}: messages differ:\n    js:   {string.Join(" / ", wantMessages)}\n    .net: {string.Join(" / ", gotMessages)}");
        }
        Assert.True(mismatches.Count == 0, $"{mismatches.Count} of {cases.Count} vectors differ from JavaScript:\n" + string.Join("\n", mismatches.Take(40)));
    }

    [Fact]
    public void The_signature_table_is_the_one_of_JavaScript()
    {
        using var doc = Load();
        var js = doc.RootElement.GetProperty("signatures").EnumerateArray().ToList();
        Assert.Equal(js.Count, FileSignatures.All.Length);
        for (int i = 0; i < js.Count; i++)
        {
            var s = FileSignatures.All[i];
            Assert.Equal(js[i].GetProperty("name").GetString(), s.Name);
            Assert.Equal(js[i].GetProperty("exts").EnumerateArray().Select(x => x.GetString()), s.Exts);
            Assert.Equal(js[i].GetProperty("executable").GetBoolean(), s.Executable);
        }
        Assert.Equal(FileTables.SignatureNames, FileSignatures.All.Select(s => s.Name));
    }

    // ------------------------------------------------------------------ the JavaScript config of a vector -> .NET options
    private static FileValidatorOptions ToOptions(JsonElement config)
    {
        var o = new FileValidatorOptions();
        foreach (var p in config.EnumerateObject())
        {
            switch (p.Name)
            {
                case "allowedExtensions": o.AllowedExtensions = ToList(p.Value); break;
                case "allowedMimeTypes": o.AllowedMimeTypes = ToList(p.Value); break;
                case "dangerousExtensions": o.DangerousExtensions = ToList(p.Value); break;
                case "imageDecode": o.ValidateImageDecode = p.Value.GetBoolean(); break;
                case "validate":
                    foreach (var v in p.Value.EnumerateObject())
                    {
                        bool on = v.Value.GetBoolean();
                        switch (v.Name)
                        {
                            case "mimeType": o.ValidateMimeType = on; break;
                            case "dangerousExt": o.ValidateDangerousExt = on; break;
                            case "signature": o.ValidateSignature = on; break;
                            case "imageDecode": o.ValidateImageDecode = on; break;
                            case "filenamePattern": o.FilenamePattern = on; break;
                            default: throw new NotSupportedException("validate." + v.Name);
                        }
                    }
                    break;
                case "documents":
                    if (p.Value.ValueKind == JsonValueKind.False) o.Documents = false;
                    else foreach (var d in p.Value.EnumerateObject()) Set(o.DocumentChecks, d.Name, d.Value);
                    break;
                case "mimeByExtension":
                    o.MimeByExtension = p.Value.EnumerateObject().ToDictionary(x => x.Name, x => ToList(x.Value).ToArray());
                    break;
                case "messages": o.Messages = p.Value.EnumerateObject().ToDictionary(x => x.Name, x => x.Value.GetString()!); break;
                default: Set(o, p.Name, p.Value); break;
            }
        }
        return o;
    }

    private static List<string> ToList(JsonElement e)
        => e.ValueKind == JsonValueKind.String ? e.GetString()!.Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).ToList()
                                              : e.EnumerateArray().Select(x => x.GetString()!).ToList();

    private static void Set(object target, string jsName, JsonElement value)
    {
        var prop = target.GetType().GetProperty(jsName, BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance)
                   ?? throw new NotSupportedException("The test has no mapping for the option '" + jsName + "'");
        var type = Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType;
        object? v = type == typeof(bool) ? value.GetBoolean()
                  : type == typeof(int) ? value.GetInt32()
                  : type == typeof(long) ? value.GetInt64()
                  : type == typeof(double) ? value.GetDouble()
                  : type == typeof(string) ? value.GetString()
                  : throw new NotSupportedException(prop.PropertyType.Name + " for " + jsName);
        prop.SetValue(target, v);
    }
}
