# FormAndFileValidator (.NET)

The server side of [form-and-file-validator](https://github.com/Kalam031/form-and-file-validator): the **same form rules, with the same answers** as the JavaScript package (browser, Angular, React, Vue), so the browser and your API never disagree.

Both are tested against one file of conformance vectors (`spec/form-rules.vectors.json`): hundreds of values per rule with the expected result. A form accepted in the browser is accepted here, and the other way round.

```csharp
using FormAndFileValidator;

var result = FormValidator.CheckValue("31/04/2024", new[] { Rule.Required(), Rule.Date("d/M/y") });
// result.Valid == false, result.Rule == "date", result.Message == "Please enter a valid date."

// or share the rule definitions with the browser as JSON
var rules = FormValidator.ParseRules("""["required", {"type":"minlength","min":3}, "email"]""");
```

Check a whole request body:

```csharp
var r = FormValidator.CheckValues(
    new Dictionary<string, string?> { ["email"] = "a@b", ["pw"] = "secret", ["pw2"] = "secret!" },
    new Dictionary<string, IReadOnlyList<Rule>>
    {
        ["email"] = new[] { Rule.Required(), Rule.Email() },
        ["pw"] = new[] { Rule.Required(), Rule.PwCheck(minLength: 8, requireUppercase: true, requireDigit: true) },
        ["pw2"] = new[] { Rule.EqualTo("pw") },
    });
// r.Valid, r.Errors["email"], r.Details["pw2"].Rule ...
```

Dates always name their format (`d/M/y`, `MM/dd/yyyy`, `yyyy-MM-dd HH:mm`): 05/03/2024 means different days in different countries, so nothing is guessed. Without a format a date must be ISO 8601.

## Uploaded files (FileValidator)

The browser check of the JavaScript `FileValidator` helps users; only a check on the server protects you. `FileValidator.Validate` runs the **same checks with the same codes and messages** (tested against `spec/file-rules.vectors.json`, 160+ files), on `IFormFile`, `HttpPostedFileBase`, streams, bytes and paths. No dependencies, no image library.

```csharp
using FormAndFileValidator;

// ASP.NET Core:  IFormFile, IFormFileCollection, List<IFormFile>       MVC 5:  HttpPostedFileBase, Request.Files
var result = FileValidator.ValidateRaw(files, new FileValidatorOptions
{
    AllowedExtensions = { "jpg", "png", "pdf" },
    MaxFileSizeMB = 5,
    MaxFiles = 3,
});
if (!result.IsValid) return BadRequest(result.Summary());   // ["photo.png: This file is 6 MB but the maximum is 5 MB."]
// result.Errors = ["SIZE_TOO_LARGE"], result.Issues[0].Code / .FileName / .Params / .Message, result.Files[i]
```

What it checks, always on: dangerous and disguised names (`invoice.exe.pdf`), program content under a harmless name (Windows, Linux, macOS executables, scripts), the first bytes against the extension (about 45 formats), macros, ActiveX and embedded programs in Office files, JavaScript and launch actions in PDF, ZIP bombs and damaged ZIP/Office/PDF files, scripts in SVG. On request: extension and MIME allow lists, `Accept` (the HTML attribute text), size per file and in total, number of files, duplicate names, image width, height and aspect ratio (read from the file header), folder paths, a malware scanner (`Scan`) and your own check (`Custom`).

Put the rules on the model, like `[FormRules]`:

```csharp
public class ProfileModel
{
    [FileRules(Extensions = "png,jpg", MaxSizeMB = 5, Required = true)]  public IFormFile Avatar { get; set; }
    [FileRules(Accept = "application/pdf", MaxFiles = 3)]                public List<IFormFile> Documents { get; set; }
}
// ModelState.IsValid now includes the files. For the browser: ModelFileRules.ToJson<ProfileModel>()  (MVC 5: @Html.FileRulesJson())
```

`UploadedFile.From(object)` recognises the file objects of ASP.NET Core and MVC 5 by their members, so the library references neither framework. A malware scanner is one line: `Scan = f => MyScanner.IsInfected(f.Open()) ? ScanResult.Infected("Trojan") : ScanResult.Clean`.
