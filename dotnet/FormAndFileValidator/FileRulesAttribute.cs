#nullable disable
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace FormAndFileValidator;

/// <summary>
/// Puts the file rules on a model property that receives an upload (<c>IFormFile</c>, <c>IFormFileCollection</c>, <c>HttpPostedFileBase</c>,
/// a list of them, or <see cref="UploadedFile"/>), so one definition drives the server (<c>ModelState</c>) and the browser
/// (<see cref="ModelFileRules.ToJson(Type)"/> gives the config of the JavaScript FileValidator).
/// <code>
/// [FileRules(Extensions = "jpg,png", MaxSizeMB = 5, Required = true)]  public IFormFile Avatar { get; set; }
/// [FileRules(Accept = "application/pdf", MaxFiles = 3)]                 public List&lt;IFormFile&gt; Documents { get; set; }
/// </code>
/// The safety checks (dangerous names, program content, disguised extensions, macros in Office files, scripts in PDF and SVG) are always on.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class FileRulesAttribute : ValidationAttribute
{
    /// <summary>Allowed extensions, comma separated: <c>"jpg,png"</c> (dot optional).</summary>
    public string Extensions { get; set; }

    /// <summary>Allowed MIME types, comma separated, wildcards allowed: <c>"image/*,application/pdf"</c>.</summary>
    public string MimeTypes { get; set; }

    /// <summary>The same text as the HTML <c>accept</c> attribute: <c>".jpg,.png,image/*"</c>.</summary>
    public string Accept { get; set; }

    /// <summary>Largest size of one file in MB. 0 = no limit.</summary>
    public double MaxSizeMB { get; set; }

    /// <summary>Smallest size of one file in KB. 0 = no limit.</summary>
    public double MinSizeKB { get; set; }

    /// <summary>Largest total size of all files in MB. 0 = no limit.</summary>
    public double MaxTotalSizeMB { get; set; }

    /// <summary>Most files. 0 = no limit.</summary>
    public int MaxFiles { get; set; }

    /// <summary>Fewest files. 0 = none required (use <see cref="Required"/>).</summary>
    public int MinFiles { get; set; }

    public int MaxImageWidth { get; set; }
    public int MaxImageHeight { get; set; }
    public int MinImageWidth { get; set; }
    public int MinImageHeight { get; set; }

    /// <summary><c>"16:9"</c>, <c>"1:1"</c>, <c>"1.5"</c>.</summary>
    public string AspectRatio { get; set; }

    /// <summary>A file must be sent.</summary>
    public bool Required { get; set; }

    /// <summary>Zero-byte files are fine.</summary>
    public bool AllowEmpty { get; set; }

    /// <summary>Two files with the same name are rejected.</summary>
    public bool DuplicateNames { get; set; }

    /// <summary>The options this attribute stands for.</summary>
    public FileValidatorOptions ToOptions()
    {
        var o = new FileValidatorOptions { AllowEmpty = AllowEmpty, DuplicateNames = DuplicateNames, Accept = Accept, AspectRatio = string.IsNullOrWhiteSpace(AspectRatio) ? null : AspectRatio };
        if (!string.IsNullOrWhiteSpace(Extensions)) o.AllowedExtensions = Split(Extensions);
        if (!string.IsNullOrWhiteSpace(MimeTypes)) o.AllowedMimeTypes = Split(MimeTypes);
        if (MaxSizeMB > 0) o.MaxFileSizeMB = MaxSizeMB;
        if (MinSizeKB > 0) o.MinFileSizeKB = MinSizeKB;
        if (MaxTotalSizeMB > 0) o.MaxTotalSizeMB = MaxTotalSizeMB;
        if (MaxFiles > 0) o.MaxFiles = MaxFiles;
        if (MinFiles > 0) o.MinFiles = MinFiles;
        if (MaxImageWidth > 0) o.MaxImageWidth = MaxImageWidth;
        if (MaxImageHeight > 0) o.MaxImageHeight = MaxImageHeight;
        if (MinImageWidth > 0) o.MinImageWidth = MinImageWidth;
        if (MinImageHeight > 0) o.MinImageHeight = MinImageHeight;
        o.AllowNoFiles = !Required;
        return o;
    }

    /// <summary>The config of the JavaScript FileValidator for the same rules: <c>{"allowedExtensions":["jpg","png"],"maxFileSizeMB":5}</c>.</summary>
    public string ToClientJson()
    {
        var o = ToOptions();
        var sb = new StringBuilder("{");
        void Put(string name, string json) { if (sb.Length > 1) sb.Append(','); sb.Append(JsonSerializer.Serialize(name)).Append(':').Append(json); }
        string Num(double v) => v.ToString("0.###############", CultureInfo.InvariantCulture);
        if (o.AllowedExtensions.Count > 0) Put("allowedExtensions", JsonSerializer.Serialize(o.AllowedExtensions));
        if (o.AllowedMimeTypes.Count > 0) Put("allowedMimeTypes", JsonSerializer.Serialize(o.AllowedMimeTypes));
        if (!string.IsNullOrWhiteSpace(Accept)) Put("accept", JsonSerializer.Serialize(Accept));
        if (o.MaxFileSizeMB != null) Put("maxFileSizeMB", Num(o.MaxFileSizeMB.Value));
        if (o.MinFileSizeKB != null) Put("minFileSizeKB", Num(o.MinFileSizeKB.Value));
        if (o.MaxTotalSizeMB != null) Put("maxTotalSizeMB", Num(o.MaxTotalSizeMB.Value));
        if (o.MaxFiles != null) Put("maxFiles", Num(o.MaxFiles.Value));
        if (o.MinFiles != null) Put("minFiles", Num(o.MinFiles.Value));
        if (o.MaxImageWidth != null) Put("maxImageWidth", Num(o.MaxImageWidth.Value));
        if (o.MaxImageHeight != null) Put("maxImageHeight", Num(o.MaxImageHeight.Value));
        if (o.MinImageWidth != null) Put("minImageWidth", Num(o.MinImageWidth.Value));
        if (o.MinImageHeight != null) Put("minImageHeight", Num(o.MinImageHeight.Value));
        if (o.AspectRatio != null) Put("aspectRatio", JsonSerializer.Serialize(o.AspectRatio));
        if (AllowEmpty) Put("allowEmpty", "true");
        if (DuplicateNames) Put("duplicateNames", "true");
        if (!Required) Put("allowNoFiles", "true");
        return sb.Append('}').ToString();
    }

    protected override ValidationResult IsValid(object value, ValidationContext validationContext)
    {
        var files = UploadedFile.FromMany(value);
        var result = FileValidator.Validate(files, ToOptions());
        if (result.IsValid) return ValidationResult.Success;
        string message = ErrorMessage ?? string.Join(" ", result.Summary(files.Count > 1));
        return validationContext?.MemberName is null ? new ValidationResult(message) : new ValidationResult(message, new[] { validationContext.MemberName });
    }

    static List<string> Split(string list) => list.Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
}

/// <summary>Reads the <see cref="FileRulesAttribute"/>s of a model class.</summary>
public static class ModelFileRules
{
    /// <summary>The rules of each property that has [FileRules], keyed by property name (the form field name in MVC).</summary>
    public static IReadOnlyDictionary<string, FileRulesAttribute> For(Type model)
    {
        var map = new Dictionary<string, FileRulesAttribute>();
        foreach (var p in model.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var a = (FileRulesAttribute)Attribute.GetCustomAttribute(p, typeof(FileRulesAttribute), true);
            if (a != null) map[p.Name] = a;
        }
        return map;
    }

    public static IReadOnlyDictionary<string, FileRulesAttribute> For<T>() => For(typeof(T));

    /// <summary>
    /// <c>{"Avatar":{"allowedExtensions":["jpg","png"],"maxFileSizeMB":5}}</c>: the configs for the browser, one per field name, built from the same
    /// attributes the server validates with. Escaped for use inside a script element.
    /// </summary>
    public static string ToJson(Type model)
    {
        var sb = new StringBuilder("{");
        bool first = true;
        foreach (var kv in For(model))
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append(JsonSerializer.Serialize(kv.Key)).Append(':').Append(kv.Value.ToClientJson());
        }
        string json = sb.Append('}').ToString();
        char bs = (char)92;
        return json.Replace("<", bs + "u003c").Replace(">", bs + "u003e").Replace("&", bs + "u0026");
    }

    public static string ToJson<T>() => ToJson(typeof(T));
}
