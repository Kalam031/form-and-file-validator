using System.Globalization;
using System.Text.Json;

namespace FormAndFileValidator;

/// <summary>
/// One validation rule, the same shape as in the JavaScript package: a type plus options.
/// Build it in code (<c>Rule.Email()</c>, <c>Rule.MinLength(3)</c>) or read the very same JSON rule definitions the browser uses (<see cref="FromJson"/>).
/// </summary>
public sealed class Rule
{
    public string Type { get; }
    public IReadOnlyDictionary<string, object?> Options { get; }

    /// <summary>Overrides the default message for this rule. May contain {min}, {max}, {step} and {0}, {1}.</summary>
    public string? Message { get; init; }

    /// <summary>The rule applies only when this returns true (the value is passed in).</summary>
    public Func<string, bool>? When { get; init; }

    /// <summary>For <c>custom</c> rules: return true when the value is acceptable.</summary>
    public Func<string, bool>? Predicate { get; init; }

    public Rule(string type, IReadOnlyDictionary<string, object?>? options = null)
    {
        Type = type ?? throw new ArgumentNullException(nameof(type));
        Options = options ?? new Dictionary<string, object?>();
    }

    // ------------------------------------------------------------ options as the engine reads them
    internal bool Has(string key) => Options.ContainsKey(key) && Options[key] is not null;

    internal string? Str(string key) => Options.TryGetValue(key, out var v) ? v switch
    {
        null => null,
        string s => s,
        double d => JsText.NumberToString(d),
        bool b => b ? "true" : "false",
        _ => v.ToString()
    } : null;

    /// <summary>A number option, read like the engine reads it: numbers as they are, text only when it is a plain decimal.</summary>
    internal double Num(string key, double fallback = double.NaN)
    {
        if (!Options.TryGetValue(key, out var v) || v is null) return fallback;
        return v switch { double d => d, int i => i, long l => l, string s => Numbers.Parse(s), _ => double.NaN };
    }

    internal bool Flag(string key) => Options.TryGetValue(key, out var v) && v is true;

    internal IReadOnlyList<object?> List(string key) =>
        Options.TryGetValue(key, out var v) && v is IReadOnlyList<object?> l ? l : Array.Empty<object?>();

    // ------------------------------------------------------------ factories (same names as the JavaScript rules)
    static Rule Make(string type, params (string, object?)[] options) =>
        new(type, options.ToDictionary(o => o.Item1, o => o.Item2));

    public static Rule Required() => Make("required");
    public static Rule Email() => Make("email");
    public static Rule Url(bool requireProtocol = false, bool allowLocal = false, IEnumerable<string>? protocols = null) =>
        Make("url", ("requireProtocol", requireProtocol), ("allowLocal", allowLocal), ("protocols", protocols?.Cast<object?>().ToList()));
    public static Rule Number() => Make("number");
    public static Rule Digits() => Make("digits");
    public static Rule Alpha() => Make("alpha");
    public static Rule Alphanumeric() => Make("alphanumeric");
    public static Rule Phone() => Make("phone");
    public static Rule CreditCard() => Make("creditcard");

    /// <summary>A date. Give a <paramref name="format"/> such as "d/M/y", "MM/dd/yyyy" or "yyyy-MM-dd HH:mm"; without one the date must be ISO 8601.</summary>
    public static Rule Date(string? format = null) => Make("date", ("format", format), ("strict", format is null));
    public static Rule MinDate(string min, string? format = null) => Make("minDate", ("min", min), ("format", format), ("strict", format is null));
    public static Rule MaxDate(string max, string? format = null) => Make("maxDate", ("max", max), ("format", format), ("strict", format is null));

    public static Rule Pattern(string pattern, string? flags = null) => Make("pattern", ("pattern", pattern), ("flags", flags));
    public static Rule MinLength(int min) => Make("minlength", ("min", (double)min));
    public static Rule MaxLength(int max) => Make("maxlength", ("max", (double)max));
    public static Rule RangeLength(int min, int max) => Make("rangelength", ("min", (double)min), ("max", (double)max));
    public static Rule Min(double min) => Make("min", ("min", min));
    public static Rule Max(double max) => Make("max", ("max", max));
    public static Rule Range(double min, double max) => Make("range", ("min", min), ("max", max));
    public static Rule Step(double step, double baseValue = 0) => Make("step", ("step", step), ("base", baseValue));
    public static Rule OneOf(params string[] values) => Make("oneOf", ("values", values.Cast<object?>().ToList()));
    public static Rule NotOneOf(params string[] values) => Make("notOneOf", ("values", values.Cast<object?>().ToList()));
    public static Rule Integer() => Make("integer");
    public static Rule Uuid() => Make("uuid");
    public static Rule HexColor() => Make("hexColor");
    public static Rule Slug() => Make("slug");
    public static Rule Ipv4() => Make("ipv4");
    public static Rule Ipv6() => Make("ipv6");
    public static Rule Iban() => Make("iban");

    /// <summary>24-hour time, <c>HH:mm</c> or <c>HH:mm:ss</c>.</summary>
    public static Rule Time() => Make("time");
    public static Rule Domain() => Make("domain");
    public static Rule Base64() => Make("base64");
    public static Rule Mac() => Make("mac");
    public static Rule Latitude() => Make("latitude");
    public static Rule Longitude() => Make("longitude");
    public static Rule StartsWith(string value) => Make("startsWith", ("value", value));
    public static Rule EndsWith(string value) => Make("endsWith", ("value", value));
    public static Rule Contains(string value) => Make("contains", ("value", value));
    public static Rule MinWords(int min) => Make("minWords", ("min", (double)min));
    public static Rule MaxWords(int max) => Make("maxWords", ("max", (double)max));
    public static Rule EqualTo(string field) => Make("equalTo", ("target", field));
    public static Rule NotEqualTo(string field) => Make("notEqualTo", ("target", field));

    public static Rule PwCheck(int minLength = 6, int? maxLength = null, bool requireUppercase = false, bool requireLowercase = false,
                               bool requireDigit = false, bool requireSpecialChar = false, bool noWhitespace = false) =>
        Make("pwcheck", ("minLength", (double)minLength), ("maxLength", maxLength is null ? null : (double)maxLength),
             ("requireUppercase", requireUppercase), ("requireLowercase", requireLowercase), ("requireDigit", requireDigit),
             ("requireSpecialChar", requireSpecialChar), ("noWhitespace", noWhitespace));

    /// <summary>Your own check. The message is shown when <paramref name="isValid"/> returns false.</summary>
    public static Rule Custom(Func<string, bool> isValid, string message) =>
        new("custom") { Predicate = isValid, Message = message };

    // ------------------------------------------------------------ JSON (the same definitions the JavaScript package reads)
    /// <summary>"email", {"type":"minlength","min":3}, or a list of them, as a rule list.</summary>
    public static IReadOnlyList<Rule> ParseList(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return FromJson(doc.RootElement);
    }

    public static IReadOnlyList<Rule> FromJson(JsonElement e)
    {
        if (e.ValueKind == JsonValueKind.Array) return e.EnumerateArray().SelectMany(FromJson).ToList();
        if (e.ValueKind == JsonValueKind.String) return new[] { new Rule(e.GetString()!) };
        if (e.ValueKind != JsonValueKind.Object) throw new FormatException("A rule must be a name, an object with a type, or a list of them.");
        if (e.TryGetProperty("type", out var t))
        {
            var options = new Dictionary<string, object?>();
            foreach (var p in e.EnumerateObject())
                if (p.Name != "type" && p.Name != "message") options[p.Name] = Convert(p.Value);
            return new[] { new Rule(t.GetString()!, options) { Message = e.TryGetProperty("message", out var m) && m.ValueKind == JsonValueKind.String ? m.GetString() : null } };
        }
        // the map shorthand the JavaScript package also reads: { "required": true, "minlength": 3, "range": [1, 5] }
        var list = new List<Rule>();
        foreach (var p in e.EnumerateObject())
        {
            if (p.Value.ValueKind == JsonValueKind.False) continue;
            list.Add(FromShorthand(p.Name, p.Value));
        }
        var first = list.Where(r => r.Type == "required");
        return first.Concat(list.Where(r => r.Type != "required")).ToList();
    }

    static Rule FromShorthand(string name, JsonElement v)
    {
        if (v.ValueKind == JsonValueKind.True) return new Rule(name);
        if (v.ValueKind == JsonValueKind.Object) { var inner = (Dictionary<string, object?>)Convert(v)!; return new Rule(name, inner); }
        var opts = new Dictionary<string, object?>();
        object? val = Convert(v);
        switch (name)
        {
            case "minlength": case "min": case "minDate": case "minWords": opts["min"] = val; break;
            case "maxlength": case "max": case "maxDate": case "maxWords": opts["max"] = val; break;
            case "startsWith": case "endsWith": case "contains": opts["value"] = val; break;
            case "notOneOf": opts["values"] = val; break;
            case "rangelength": case "range": { var l = (List<object?>)val!; opts["min"] = l[0]; opts["max"] = l[1]; break; }
            case "step": opts["step"] = val; break;
            case "equalTo": case "notEqualTo": opts["target"] = val is string s ? s.TrimStart('#') : val; break;
            case "oneOf": opts["values"] = val; break;
            case "pattern": opts["pattern"] = val; break;
            case "date": opts["format"] = val; break;
            default: opts["param"] = val; break;
        }
        return new Rule(name, opts);
    }

    static object? Convert(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => e.GetString(),
        JsonValueKind.Number => e.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Array => e.EnumerateArray().Select(Convert).ToList(),
        JsonValueKind.Object => e.EnumerateObject().ToDictionary(p => p.Name, p => Convert(p.Value)),
        _ => null
    };

    public override string ToString() => Type;

    internal static string FormatNumber(double d) => JsText.NumberToString(d);
}

internal static class Numbers
{
    static readonly System.Text.RegularExpressions.Regex Re = new(@"^[-+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][-+]?[0-9]+)?\z", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    public static bool IsDecimal(string s) => Re.IsMatch(s);

    /// <summary>Plain decimal numbers only (no 0x10, no Infinity, no digits of other scripts); NaN otherwise.</summary>
    public static double Parse(string s)
    {
        s = JsText.Trim(s);
        return Re.IsMatch(s) ? double.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture) : double.NaN;
    }
}
