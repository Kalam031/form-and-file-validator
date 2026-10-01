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
