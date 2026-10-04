namespace FormAndFileValidator;

/// <summary>One problem: a stable code (the same codes as the JavaScript FileValidator), the file it is about and a readable message.</summary>
public sealed class FileIssue
{
    /// <summary>For example <c>SIZE_TOO_LARGE</c>, <c>DANGEROUS_CONTENT</c>, <c>SIGNATURE_MISMATCH</c>.</summary>
    public string Code { get; }

    /// <summary>The file name, or null for a problem with the whole selection (too many files...).</summary>
    public string? FileName { get; }

    /// <summary>The values behind the message: max, size, extension, detected...</summary>
    public IReadOnlyDictionary<string, string> Params { get; }

    public string Message { get; }

    internal FileIssue(string code, string? fileName, IReadOnlyDictionary<string, string> parameters, string message)
    {
        Code = code; FileName = fileName; Params = parameters; Message = message;
    }

    public override string ToString() => (FileName != null ? FileName + ": " : "") + Message;
}

/// <summary>The result for one file.</summary>
public sealed class FileResult
{
    public string Name { get; }
    public bool IsValid => Issues.Count == 0;
    public IReadOnlyList<string> Errors { get; }
    public IReadOnlyList<FileIssue> Issues { get; }

    internal FileResult(string name, IReadOnlyList<FileIssue> issues)
    {
        Name = name;
        Issues = issues;
        Errors = issues.Select(i => i.Code).Distinct().ToList();
    }
}

/// <summary>The result for a whole selection.</summary>
public sealed class FileValidationResult
{
    public bool IsValid => Issues.Count == 0;

    /// <summary>The distinct codes of all problems.</summary>
    public IReadOnlyList<string> Errors { get; }

    /// <summary>Problems of the whole selection first, then those of each file.</summary>
    public IReadOnlyList<FileIssue> Issues { get; }

    public IReadOnlyList<FileResult> Files { get; }

    /// <summary>Files that were skipped because of <see cref="FileValidatorOptions.IgnoreFiles"/>.</summary>
    public IReadOnlyList<string> Ignored { get; }

    internal FileValidationResult(IReadOnlyList<FileIssue> issues, IReadOnlyList<FileResult> files, IReadOnlyList<string> ignored)
    {
        Issues = issues;
        Files = files;
        Ignored = ignored;
        Errors = issues.Select(i => i.Code).Distinct().ToList();
    }

    /// <summary>Readable lines: <c>photo.png: This file is 6 MB but the maximum is 5 MB.</c></summary>
    public IList<string> Summary(bool withFileNames = true)
        => Issues.Select(i => (withFileNames && i.FileName != null ? i.FileName + ": " : "") + i.Message).ToList();

    /// <summary>The first message, or an empty string when everything is fine (for a form field error).</summary>
    public string FirstMessage => Issues.Count == 0 ? "" : Issues[0].ToString();
}
