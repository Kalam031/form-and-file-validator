using System.Text.RegularExpressions;

namespace FormAndFileValidator;

/// <summary>
/// What a file must satisfy. Every check is on when its value is set (like the JavaScript <c>FileValidator</c> config; the names are the same).
/// Nothing set means: the built-in safety checks only (dangerous names, program content, disguised extensions, empty files).
/// </summary>
public sealed class FileValidatorOptions
{
    /// <summary>Allowed extensions, case-insensitive, with or without the dot: <c>{ "jpg", ".png" }</c>. An explicit allow also overrides the dangerous list.</summary>
    public IList<string> AllowedExtensions { get; set; } = new List<string>();

    /// <summary>Allowed MIME types, <c>image/*</c> wildcards supported. Falls back to the type of the extension when the client reported none.</summary>
    public IList<string> AllowedMimeTypes { get; set; } = new List<string>();

    public bool AllowUnknownMime { get; set; }

    /// <summary>The same text as the HTML attribute: <c>".jpg,.png,image/*,application/pdf"</c>. Fills <see cref="AllowedExtensions"/> and <see cref="AllowedMimeTypes"/> when those are not set.</summary>
    public string? Accept { get; set; }

    /// <summary>Replaces the built-in list of blocked extensions.</summary>
    public IList<string>? DangerousExtensions { get; set; }

    /// <summary>Replaces the built-in list of program and script MIME types.</summary>
    public IList<string>? DangerousMimeTypes { get; set; }

    /// <summary>Per-call MIME types for extensions (overrides the registry): <c>[".xyz"] = new[] { "application/x-xyz" }</c>.</summary>
    public IDictionary<string, string[]>? MimeByExtension { get; set; }

    public double? MaxFileSizeMB { get; set; }
    public long? MaxFileSize { get; set; }
    public double? MinFileSizeKB { get; set; }
    public long? MinFileSize { get; set; }
    public double? MaxTotalSizeMB { get; set; }
    public int? MaxFiles { get; set; }
    public int? MinFiles { get; set; }

    /// <summary>An empty selection is fine.</summary>
    public bool AllowNoFiles { get; set; }

    /// <summary>Zero-byte files are fine.</summary>
    public bool AllowEmpty { get; set; }

    /// <summary>Program content (exe, ELF, scripts with a shebang...) is fine.</summary>
    public bool AllowExecutables { get; set; }

    /// <summary>Default 255.</summary>
    public int? MaxFilenameLength { get; set; }

    /// <summary>Only letters, digits, <c>_ - . ( ) [ ]</c> and spaces in the name (Unicode letters allowed).</summary>
    public bool FilenamePattern { get; set; }

    /// <summary>Your own pattern for the name (switches the name pattern check on).</summary>
    public Regex? FilenameRegex { get; set; }

    /// <summary>Two files with the same name (case-insensitive) are rejected.</summary>
    public bool DuplicateNames { get; set; }

    public int? MaxImageWidth { get; set; }
    public int? MaxImageHeight { get; set; }
    public int? MinImageWidth { get; set; }
    public int? MinImageHeight { get; set; }

    /// <summary>"16:9", "4/3", "1.5" or a number as text. Compared with <see cref="AspectRatioTolerance"/> (default 0.01).</summary>
    public string? AspectRatio { get; set; }
    public double? AspectRatioTolerance { get; set; }

    /// <summary>For files picked from a folder: the most folders deep, and the longest path.</summary>
    public int? MaxPathDepth { get; set; }
    public int? MaxPathLength { get; set; }

    /// <summary>Skip junk files (.DS_Store, Thumbs.db, desktop.ini, ~$ lock files, ._ files) instead of validating them.</summary>
    public bool IgnoreFiles { get; set; }

    /// <summary>Look inside PDF, Office and ZIP files (macros, scripts, bombs, damage). Default on.</summary>
    public bool Documents { get; set; } = true;

    /// <summary>Settings of the document inspection.</summary>
    public DocumentOptions DocumentChecks { get; set; } = new DocumentOptions();

    /// <summary>Block SVG files that contain scripts. Default on.</summary>
    public bool ScanSvg { get; set; } = true;

    // the `validate: { name: false }` switches of the JavaScript config
    public bool ValidateDangerousExt { get; set; } = true;
    public bool ValidateMimeType { get; set; } = true;
    public bool ValidateSignature { get; set; } = true;
    public bool ValidateImageDecode { get; set; } = true;

    /// <summary>Message templates by code, <c>{size}</c>-style placeholders filled from the issue parameters. Overrides the English defaults.</summary>
    public IDictionary<string, string>? Messages { get; set; }

    /// <summary>
    /// Your own check for a file that passed everything else. Return null when it is fine, or the message to show.
    /// </summary>
    public Func<UploadedFile, string?>? Custom { get; set; }

    /// <summary>
    /// A malware scanner: called for a file that passed everything else. Return <see cref="ScanResult.Clean"/> or a threat.
    /// If it throws, the file is rejected with <c>SCAN_ERROR</c> unless <see cref="ScanFailOpen"/> is set.
    /// </summary>
    public Func<UploadedFile, ScanResult>? Scan { get; set; }

    public bool ScanFailOpen { get; set; }

    /// <summary>The options with <see cref="Accept"/> turned into the two lists (a copy, your object is not changed).</summary>
    internal FileValidatorOptions Effective()
    {
        if (string.IsNullOrWhiteSpace(Accept)) return this;
        var copy = (FileValidatorOptions)MemberwiseClone();
        var parts = Accept!.Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
        var exts = parts.Where(x => x.StartsWith(".", StringComparison.Ordinal)).ToList();
        var mimes = parts.Where(x => x.Contains('/')).ToList();
        if (exts.Count > 0 && AllowedExtensions.Count == 0) copy.AllowedExtensions = exts;
        if (mimes.Count > 0 && AllowedMimeTypes.Count == 0) copy.AllowedMimeTypes = mimes;
        return copy;
    }
}

/// <summary>What to look for inside PDF, Office and ZIP files (all on by default, like the JavaScript <c>documents</c> option).</summary>
public sealed class DocumentOptions
{
    public bool CheckStructure { get; set; } = true;
    public bool BlockMacros { get; set; } = true;
    public bool BlockEmbeddedPrograms { get; set; } = true;
    public bool BlockUnsafePaths { get; set; } = true;
    public bool BlockPdfJavaScript { get; set; } = true;
    public bool BlockPdfLaunch { get; set; } = true;
    public int MaxScanMB { get; set; } = 25;
    public int MaxUncompressedMB { get; set; } = 2048;
    public int MaxCompressionRatio { get; set; } = 250;
    public int MaxEntries { get; set; } = 20000;
}

/// <summary>The answer of a <see cref="FileValidatorOptions.Scan"/> function.</summary>
public sealed class ScanResult
{
    public bool IsClean { get; }
    public string Threat { get; }
    private ScanResult(bool clean, string threat) { IsClean = clean; Threat = threat; }
    public static ScanResult Clean { get; } = new ScanResult(true, "");
    public static ScanResult Infected(string threat = "malware") => new ScanResult(false, string.IsNullOrEmpty(threat) ? "malware" : threat);
}
