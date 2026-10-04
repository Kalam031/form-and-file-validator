using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace FormAndFileValidator;

/// <summary>
/// The server side of FileValidator: decides whether uploaded files are safe and acceptable, with the same checks, codes and messages as the
/// JavaScript package. Always validate on the server: the browser check helps users, only this one protects you.
/// <code>
/// var result = FileValidator.Validate(UploadedFile.FromMany(Request.Files), new FileValidatorOptions { AllowedExtensions = { "jpg", "png" }, MaxFileSizeMB = 5 });
/// if (!result.IsValid) return BadRequest(result.Summary());
/// </code>
/// </summary>
public static class FileValidator
{
    private static readonly string[] SafeIntermediate = { "tar", "gz", "bz2", "zip", "min", "com" };
    private static readonly string[] GenericMimes = { "", "application/octet-stream", "binary/octet-stream" };
    private static readonly string[] TolerantImageExts = { ".heic", ".heif", ".tif", ".tiff", ".avif", ".ico", ".cur" };
    private static readonly string[] DecodableSignatures = { "png", "jpeg", "gif", "webp", "bmp" };
    private static readonly Regex Reserved = new Regex(@"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.CultureInvariant);
    private static readonly Regex SvgDanger = new Regex(@"<script[\s>]|\son\w+\s*=|javascript:|<foreignObject", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex RatioText = new Regex(@"^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$", RegexOptions.ECMAScript);
    private static readonly Regex Placeholder = new Regex(@"\{(\w+)\}", RegexOptions.ECMAScript);
    private static readonly Regex IgnoredLockFile = new Regex(@"^~\$", RegexOptions.ECMAScript);
    private static readonly Regex IgnoredAppleFile = new Regex(@"^\._", RegexOptions.ECMAScript);
    private static readonly string[] IgnoredNames = { ".ds_store", "thumbs.db", "desktop.ini", ".localized" };

    /// <summary>Checks a selection of files: limits on the whole selection first, then every file.</summary>
    public static FileValidationResult Validate(IEnumerable<UploadedFile?>? files, FileValidatorOptions? options = null)
    {
        var cfg = (options ?? new FileValidatorOptions()).Effective();
        var everything = (files ?? Enumerable.Empty<UploadedFile?>()).Where(f => f != null).Select(f => f!).ToList();
        var ignored = cfg.IgnoreFiles ? everything.Where(IsIgnored).ToList() : new List<UploadedFile>();
        var list = ignored.Count > 0 ? everything.Where(f => !ignored.Contains(f)).ToList() : everything;
        var ignoredNames = ignored.Select(f => f.Name).ToList();

        if (list.Count == 0)
        {
            if (cfg.AllowNoFiles) return new FileValidationResult(new FileIssue[0], new FileResult[0], ignoredNames);
            return new FileValidationResult(new[] { Issue("NO_FILES", null, new Dictionary<string, string>(), cfg, null) }, new FileResult[0], ignoredNames);
        }

        var group = new List<FileIssue>();
        void AddGroup(string code, params (string, string)[] p) => group.Add(Issue(code, null, ToDict(p), cfg, null));

        if (cfg.MaxFiles is int max && list.Count > max) AddGroup("TOO_MANY_FILES", ("max", Str(max)));
        if (cfg.MinFiles is int min && list.Count < min) AddGroup("TOO_FEW_FILES", ("min", Str(min)));
        if (cfg.MaxTotalSizeMB is double maxTotal)
        {
            long total = list.Sum(f => f.Length);
            if (total > maxTotal * 1048576) AddGroup("TOTAL_SIZE_EXCEEDED", ("max", FormatBytes(maxTotal * 1048576)), ("size", FormatBytes(total)));
        }
        if (cfg.DuplicateNames && HasDuplicateNames(list)) AddGroup("DUPLICATE_FILENAMES");

        var perFile = list.Select(f => ValidateFile(f, cfg)).ToList();
        var all = group.Concat(perFile.SelectMany(p => p.Issues)).ToList();
        return new FileValidationResult(all, perFile, ignoredNames);
    }

    /// <summary>true when the files pass.</summary>
    public static bool IsValid(IEnumerable<UploadedFile?>? files, FileValidatorOptions? options = null) => Validate(files, options).IsValid;

    /// <summary>The same as <see cref="Validate"/> for the file objects of the framework (<c>IFormFile</c>, <c>HttpPostedFileBase</c>, collections of them).</summary>
    public static FileValidationResult ValidateRaw(object? files, FileValidatorOptions? options = null) => Validate(UploadedFile.FromMany(files), options);

    /// <summary>Checks a single file (no limits on the number of files).</summary>
    public static FileResult ValidateFile(UploadedFile file, FileValidatorOptions? options = null)
    {
        var cfg = (options ?? new FileValidatorOptions()).Effective();
        var issues = new List<FileIssue>();
        Run(file, cfg, issues);
        return new FileResult(file.Name, issues);
    }

    // ------------------------------------------------------------------ one file
    private static void Run(UploadedFile file, FileValidatorOptions cfg, List<FileIssue> issues)
    {
        void Add(string code, params (string Key, string Value)[] p) => issues.Add(Issue(code, file.Name, ToDict(p), cfg, null));
        void AddMessage(string code, string message, params (string Key, string Value)[] p) => issues.Add(Issue(code, file.Name, ToDict(p), cfg, message));
        bool Has(string code) => issues.Any(i => i.Code == code);

        string name = file.Name;
        string ext = GetExt(name);

        // ---- file name
        bool hugeName = name.Length > 4096;   // no pattern checks on absurd names: the length is the finding
        if (name.Length == 0 || (!hugeName && (HasControl(name) || HasBidi(name) || name.IndexOf('\\') >= 0 || name.IndexOf('/') >= 0 || EndsWithDotOrSpace(name)))) Add("INVALID_FILENAME");
        int maxName = cfg.MaxFilenameLength is int m && m > 0 ? m : 255;
        if (name.Length > maxName) Add("FILENAME_TOO_LONG", ("max", Str(maxName)));
        if (!hugeName && (cfg.FilenamePattern || cfg.FilenameRegex != null) && !IsValidFilename(name, cfg) && !Has("INVALID_FILENAME")) Add("INVALID_FILENAME");

        // ---- folder path
        string path = file.Path ?? "";
        if (path.Length > 0)
        {
            var segs = path.Split('/');
            if (path[0] == '/' || path.IndexOf('\\') >= 0 || segs.Any(sg => sg == "" || sg == "." || sg == ".." || HasControl(sg) || HasBidi(sg) || EndsWithDotOrSpace(sg))) Add("INVALID_PATH");
            else
            {
                if (cfg.MaxPathDepth is int depth && segs.Length - 1 > depth) Add("PATH_TOO_DEEP", ("depth", Str(segs.Length - 1)), ("max", Str(depth)));
                if (cfg.MaxPathLength is int plen && path.Length > plen) Add("PATH_TOO_LONG", ("max", Str(plen)));
            }
        }

        // the signature is read once, and only when a check needs it
        bool sigLoaded = false, sigReadable = false;
        FileSignature? sig = null;
        void LoadSig()
        {
            if (sigLoaded) return;
            sigLoaded = true;
            if (file.Length <= 0) return;
            try { var head = file.ReadRange(0, 300); sigReadable = true; sig = FileSignatures.Detect(head); }
            catch (Exception e) when (e is IOException || e is UnauthorizedAccessException || e is NotSupportedException || e is ObjectDisposedException) { sigReadable = false; }
        }
        string declaredMime = file.ContentType.ToLowerInvariant();

        // ---- dangerous names and types
        var dangerous = (cfg.DangerousExtensions ?? FileTables.DangerousExtensions).Select(NormExt).ToList();
        bool explicitlyAllowed = NonEmpty(cfg.AllowedExtensions) && cfg.AllowedExtensions!.Select(NormExt).Contains(ext);
        if (cfg.ValidateDangerousExt)
        {
            if (!hugeName && HasSuspiciousExtension(name, dangerous)) Add("HIDDEN_EXTENSION");
            if (ext.Length > 0 && dangerous.Contains(ext) && !explicitlyAllowed) Add("DANGEROUS_FILE_TYPE", ("extension", ext));
            var dangerMimes = (cfg.DangerousMimeTypes ?? FileTables.DangerousMimeTypes).Select(x => x.ToLowerInvariant()).ToList();
            bool mimeAllowed = NonEmpty(cfg.AllowedMimeTypes) && cfg.AllowedMimeTypes!.Any(x => x.ToLowerInvariant() == declaredMime);
            if (declaredMime.Length > 0 && dangerMimes.Contains(declaredMime) && !explicitlyAllowed && !mimeAllowed && !Has("DANGEROUS_FILE_TYPE"))
                Add("DANGEROUS_FILE_TYPE", ("extension", ext.Length > 0 ? ext : declaredMime), ("mime", declaredMime));
        }

        // ---- allow lists
        bool extList = NonEmpty(cfg.AllowedExtensions), mimeList = NonEmpty(cfg.AllowedMimeTypes);
        if (extList && !cfg.AllowedExtensions!.Select(NormExt).Contains(ext))
            Add("INVALID_EXTENSION", ("extension", ext), ("allowed", string.Join(", ", cfg.AllowedExtensions!)));
        if (cfg.ValidateMimeType && (mimeList || extList))
        {
            var known = MimesForExt(ext, cfg);
            bool generic = GenericMimes.Contains(declaredMime);
            string mime = generic ? (known.Length > 0 ? known[0] : "") : declaredMime;
            if (mime.Length == 0 && mimeList) { LoadSig(); if (sig != null && sig.Mime != null) mime = sig.Mime; }
            if (mimeList)
            {
                bool ok = cfg.AllowedMimeTypes!.Any(a =>
                {
                    string x = a.ToLowerInvariant();
                    return x == mime || (x.EndsWith("/*", StringComparison.Ordinal) && mime.StartsWith(x.Substring(0, x.Length - 1), StringComparison.Ordinal));
                });
                if (!ok && !(cfg.AllowUnknownMime && mime.Length == 0)) Add("INVALID_MIME", ("mime", mime.Length > 0 ? mime : "(unknown)"));
            }
            else if (!Has("INVALID_EXTENSION"))
            {
                if (known.Length == 0) { if (!cfg.AllowUnknownMime) Add("UNKNOWN_MIME", ("extension", ext.Length > 0 ? ext : "(none)")); }
                else if (!generic && !known.Contains(declaredMime)) Add("MIME_MISMATCH", ("mime", declaredMime), ("extension", ext));
            }
        }

        // ---- size
        double? maxBytes = cfg.MaxFileSizeMB is double mb ? mb * 1048576 : (cfg.MaxFileSize is long mx ? mx : (double?)null);
        double? minBytes = cfg.MinFileSizeKB is double kb ? kb * 1024 : (cfg.MinFileSize is long mn ? mn : (double?)null);
        if (maxBytes is double hi && file.Length > hi) Add("SIZE_TOO_LARGE", ("max", FormatBytes(hi)), ("size", FormatBytes(file.Length)));
        if (minBytes is double lo && file.Length < lo) Add("SIZE_TOO_SMALL", ("min", FormatBytes(lo)), ("size", FormatBytes(file.Length)));
        if (file.Length == 0 && !cfg.AllowEmpty && !Has("SIZE_TOO_SMALL")) Add("EMPTY_FILE");
        if (issues.Count > 0) return;

        // ---- content signature (magic bytes)
        if (cfg.ValidateSignature && file.Length > 0)
        {
            LoadSig();
            if (sig != null && sig.Executable)
            {
                if (!cfg.AllowExecutables) Add("DANGEROUS_CONTENT", ("detected", sig.Name));
            }
            else if (sigReadable && ext.Length > 0)
            {
                bool mismatch = sig == null
                    ? FileSignatures.SignatureExts.Contains(ext)
                    : !sig.Exts.Contains(ext) && (!sig.Weak || FileSignatures.SignatureExts.Contains(ext));
                if (mismatch) Add("SIGNATURE_MISMATCH", ("extension", ext), ("detected", sig != null ? sig.Name : "unknown"));
            }
            if (issues.Count > 0) return;
        }

        // ---- inside PDF, Office and ZIP files
        if (sig != null && !sig.Executable && cfg.Documents && file.Length > 0)
        {
            FileInspect.Document(file, ext, sig, cfg, (code, p) => Add(code, p), explicitlyAllowed);
            if (issues.Count > 0) return;
        }

        // ---- SVG can carry scripts
        if (ext == ".svg" && cfg.ScanSvg && file.Length > 0 && file.Length <= 5 * 1048576)
        {
            string text = new UTF8Encoding(false, false).GetString(file.ReadRange(0, file.Length));
            if (SvgDanger.IsMatch(text)) { Add("DANGEROUS_CONTENT", ("detected", "scripts")); return; }
        }

        // ---- image size from the header
        string mimeForCategory = declaredMime.Length > 0 ? declaredMime : (sig?.Mime ?? (FileTables.Extensions.TryGetValue(ext, out var reg) ? reg[0] : ""));
        if (mimeForCategory.StartsWith("image/", StringComparison.Ordinal) && cfg.ValidateImageDecode && sig != null && DecodableSignatures.Contains(sig.Name) && !TolerantImageExts.Contains(ext))
        {
            var size = FileInspect.ImageSize(file, sig.Name);
            if (size == null) { Add("INVALID_IMAGE"); return; }
            int w = size.Value.Width, h = size.Value.Height;
            if (cfg.MaxImageWidth is int mw && w > mw) Add("WIDTH_EXCEEDED", ("max", Str(mw)), ("width", Str(w)));
            if (cfg.MaxImageHeight is int mh && h > mh) Add("HEIGHT_EXCEEDED", ("max", Str(mh)), ("height", Str(h)));
            if (cfg.MinImageWidth is int nw && w < nw) Add("WIDTH_TOO_SMALL", ("min", Str(nw)), ("width", Str(w)));
            if (cfg.MinImageHeight is int nh && h < nh) Add("HEIGHT_TOO_SMALL", ("min", Str(nh)), ("height", Str(h)));
            if (!string.IsNullOrEmpty(cfg.AspectRatio))
            {
                double a = (double)w / h, target = ParseRatio(cfg.AspectRatio!), tol = cfg.AspectRatioTolerance ?? 0.01;
                if (!(Math.Abs(a - target) <= tol)) Add("INVALID_ASPECT_RATIO", ("ratio", JsNumber(Math.Round(a, 3, MidpointRounding.AwayFromZero))));
            }
        }

        // ---- your own check, then the scanner: only for files that passed everything else
        if (issues.Count == 0 && cfg.Custom != null)
        {
            string? problem = cfg.Custom(file);
            if (!string.IsNullOrEmpty(problem)) AddMessage("CUSTOM", problem!, ("method", "custom"));
        }
        if (issues.Count == 0 && cfg.Scan != null)
        {
            ScanResult? res;
            try { res = cfg.Scan(file); }
            catch (Exception) { res = cfg.ScanFailOpen ? ScanResult.Clean : null; if (res == null) { Add("SCAN_ERROR"); return; } }
            if (res != null && !res.IsClean) Add("MALWARE_DETECTED", ("threat", res.Threat));
        }
    }

    // ------------------------------------------------------------------ helpers
    internal static FileIssue Issue(string code, string? fileName, Dictionary<string, string> p, FileValidatorOptions cfg, string? message)
    {
        string text = message ?? Message(code, p, cfg);
        return new FileIssue(code, fileName, p, text);
    }

    /// <summary>The message of a code: your <see cref="FileValidatorOptions.Messages"/> template, else the English default.</summary>
    public static string Message(string code, IReadOnlyDictionary<string, string>? parameters, FileValidatorOptions? options = null)
    {
        string? tpl = null;
        if (options?.Messages != null && options.Messages.TryGetValue(code, out var custom)) tpl = custom;
        if (tpl == null && !FileTables.Messages.TryGetValue(code, out tpl)) tpl = code;
        return Placeholder.Replace(tpl, m => parameters != null && parameters.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    }

    private static Dictionary<string, string> ToDict(IEnumerable<(string Key, string Value)> p)
    {
        var d = new Dictionary<string, string>();
        foreach (var (k, v) in p) d[k] = v;
        return d;
    }

    private static string Str(int n) => n.ToString(CultureInfo.InvariantCulture);

    /// <summary>A size as people read it: 512 B, 1.5 KB, 2.34 MB, 1.2 GB (the same text as the JavaScript package).</summary>
    public static string FormatBytes(double n)
    {
        if (n < 1024) return JsNumber(n) + " B";
        if (n < 1024.0 * 1024) return JsNumber(Math.Round(n / 1024, 1, MidpointRounding.AwayFromZero)) + " KB";
        if (n < 1024.0 * 1024 * 1024) return JsNumber(Math.Round(n / 1024 / 1024, 2, MidpointRounding.AwayFromZero)) + " MB";
        return JsNumber(Math.Round(n / 1024 / 1024 / 1024, 2, MidpointRounding.AwayFromZero)) + " GB";
    }

    private static string JsNumber(double v) => v.ToString("0.###############", CultureInfo.InvariantCulture);

    private static bool NonEmpty(IList<string>? l) => l != null && l.Count > 0;

    private static string NormExt(string e) => "." + e.Trim().TrimStart('.').ToLowerInvariant();

    private static bool IsWhite(char c) => char.IsWhiteSpace(c) || c == (char)0xFEFF;

    private static string TrimTrailingDots(string s)
    {
        int end = s.Length;
        while (end > 0 && (s[end - 1] == '.' || IsWhite(s[end - 1]))) end--;
        return end == s.Length ? s : s.Substring(0, end);
    }

    private static string GetExt(string name)
    {
        string n = TrimTrailingDots(name);
        int i = n.LastIndexOf('.');
        return i < 0 ? "" : n.Substring(i).ToLowerInvariant();
    }

    private static bool EndsWithDotOrSpace(string s) => s.Length > 0 && (s[s.Length - 1] == '.' || s[s.Length - 1] == ' ');

    private static bool HasControl(string s) { foreach (char c in s) if (c <= 0x1f || c == 0x7f) return true; return false; }

    private static bool HasBidi(string s)
    {
        foreach (char c in s) if (c == 0x200E || c == 0x200F || (c >= 0x202A && c <= 0x202E) || (c >= 0x2066 && c <= 0x2069)) return true;
        return false;
    }

    private static bool HasSuspiciousExtension(string filename, List<string> dangerous)
    {
        var parts = TrimTrailingDots(filename.ToLowerInvariant()).Split('.');
        if (parts.Length < 3) return false;
        for (int i = 1; i < parts.Length - 1; i++)
        {
            string p = parts[i];
            if (!SafeIntermediate.Contains(p) && dangerous.Contains("." + p.Trim())) return true;
        }
        return false;
    }

    private static bool IsLetterOrDigit(string s, int i)
    {
        var cat = CharUnicodeInfo.GetUnicodeCategory(s, i);
        switch (cat)
        {
            case UnicodeCategory.UppercaseLetter: case UnicodeCategory.LowercaseLetter: case UnicodeCategory.TitlecaseLetter:
            case UnicodeCategory.ModifierLetter: case UnicodeCategory.OtherLetter:
            case UnicodeCategory.DecimalDigitNumber: case UnicodeCategory.LetterNumber: case UnicodeCategory.OtherNumber:
                return true;
            default: return false;
        }
    }

    private static bool IsValidFilename(string name, FileValidatorOptions cfg)
    {
        if (cfg.FilenameRegex != null) return cfg.FilenameRegex.IsMatch(name);
        if (name.Length == 0 || EndsWithDotOrSpace(name) || Reserved.IsMatch(name)) return false;
        for (int i = 0; i < name.Length; i += char.IsSurrogatePair(name, i) ? 2 : 1)
        {
            char c = name[i];
            bool word = IsLetterOrDigit(name, i) || c == '_' || c == '-';
            bool extra = c == '.' || c == ' ' || c == '(' || c == ')' || c == '[' || c == ']';
            if (!(word || (i > 0 && extra))) return false;
        }
        return true;
    }

    private static string[] MimesForExt(string ext, FileValidatorOptions cfg)
    {
        if (cfg.MimeByExtension != null)
            foreach (var kv in cfg.MimeByExtension)
                if (NormExt(kv.Key) == ext) return kv.Value.Select(x => x.ToLowerInvariant()).ToArray();
        return FileTables.Extensions.TryGetValue(ext, out var list) ? list : new string[0];
    }

    private static double ParseRatio(string r)
    {
        var m = RatioText.Match(r);
        if (m.Success) return double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture) / double.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture);
        return double.TryParse(r, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : double.NaN;
    }

    private static bool HasDuplicateNames(List<UploadedFile> files)
    {
        var seen = new HashSet<string>();
        foreach (var f in files) if (!seen.Add(f.Name.ToLowerInvariant())) return true;
        return false;
    }

    private static bool IsIgnored(UploadedFile f)
    {
        string n = f.Name;
        return IgnoredNames.Contains(n.ToLowerInvariant()) || IgnoredLockFile.IsMatch(n) || IgnoredAppleFile.IsMatch(n);
    }
}
