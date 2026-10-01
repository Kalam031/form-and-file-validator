using System.Globalization;
using System.Text.RegularExpressions;

namespace FormAndFileValidator;

/// <summary>The answer for one value.</summary>
/// <param name="Valid">true when every rule passed.</param>
/// <param name="Rule">The type of the first rule that failed (null when valid).</param>
/// <param name="Message">The error message (empty when valid).</param>
public sealed record CheckResult(bool Valid, string? Rule, string Message);

/// <summary>The answer for a whole object.</summary>
public sealed record ValuesResult(bool Valid, IReadOnlyDictionary<string, string> Errors, IReadOnlyDictionary<string, CheckResult> Details);

public sealed class CheckOptions
{
    /// <summary>Trim the value first, like the browser does (default true; the password rule never trims).</summary>
    public bool Trim { get; init; } = true;

    /// <summary>The other fields, for equalTo / notEqualTo.</summary>
    public IReadOnlyDictionary<string, string?>? Values { get; init; }

    /// <summary>Replaces the default message of a rule type: <c>{ ["required"] = "Pflichtfeld" }</c>.</summary>
    public IReadOnlyDictionary<string, string>? Messages { get; init; }

    /// <summary>What "today" means for minDate / maxDate (default: the server's current date). Handy in tests.</summary>
    public Func<DateTime>? Today { get; init; }
}

/// <summary>
/// The FormValidator rules for the server. The same rules, options and answers as the JavaScript package; both are tested against
/// the same conformance vectors (spec/form-rules.vectors.json), so a form accepted in the browser is accepted here, and the other way round.
/// </summary>
public static class FormValidator
{
    // ------------------------------------------------------------------ messages (English defaults, same text as the browser)
    public static IDictionary<string, string> DefaultMessages { get; } = new Dictionary<string, string>
    {
        ["required"] = "This field is required.",
        ["email"] = "Please enter a valid email address.",
        ["url"] = "Please enter a valid URL.",
        ["number"] = "Please enter a valid number.",
        ["digits"] = "Please enter digits only.",
        ["alpha"] = "Please use letters only.",
        ["alphanumeric"] = "Please use letters and numbers only.",
        ["phone"] = "Please enter a valid phone number.",
        ["date"] = "Please enter a valid date.",
        ["minDate"] = "Date must be on or after {min}.",
        ["maxDate"] = "Date must be on or before {max}.",
        ["creditcard"] = "Please enter a valid card number.",
        ["pattern"] = "Invalid format.",
        ["maxlength"] = "Please enter no more than {max} characters.",
        ["minlength"] = "Please enter at least {min} characters.",
        ["rangelength"] = "Please enter between {min} and {max} characters.",
        ["range"] = "Please enter a value between {min} and {max}.",
        ["max"] = "Please enter a value no greater than {max}.",
        ["min"] = "Please enter a value no less than {min}.",
        ["step"] = "Please enter a multiple of {step}.",
        ["oneOf"] = "Please choose a valid option.",
        ["notEqualTo"] = "This value is not allowed.",
        ["equalTo"] = "Values do not match.",
        ["pwcheck"] = "Password does not meet the requirements.",
        ["custom"] = "Invalid value."
    };

    static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(1);
    static readonly string Ws = JsText.WsClass;
    static readonly Regex EmailRe = new($@"^[^{Ws}@]+@[^{Ws}@]+\.[^{Ws}@]{{2,}}\z", RegexOptions.CultureInvariant, RegexTimeout);
    static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);
    static readonly Regex PhoneChars = new($@"^\+?[0-9{Ws}\-().]{{7,25}}\z", RegexOptions.CultureInvariant, RegexTimeout);
    static readonly Regex StripCard = new($@"[{Ws}\-]", RegexOptions.CultureInvariant);
    static readonly Regex CardRe = new(@"^[0-9]{12,19}\z", RegexOptions.CultureInvariant);
    static readonly string[] DefaultProtocols = { "http:", "https:" };

    // ------------------------------------------------------------------ public API
    /// <summary>Checks one value against rules, in order; the first failure wins. Blank values skip every rule except required (and equalTo).</summary>
    public static CheckResult CheckValue(string? value, IEnumerable<Rule> rules, CheckOptions? options = null)
    {
        options ??= new CheckOptions();
        string raw = value ?? "";
        string trimmed = options.Trim ? JsText.Trim(raw) : raw;
        var today = (options.Today ?? (() => DateTime.Now))();

        var list = Order(rules);
        foreach (var rule in list)
        {
            string v = rule.Type == "pwcheck" ? raw : trimmed;
            bool empty = v.Length == 0;
            if (rule.When is not null && !rule.When(v)) continue;
            bool runsOnEmpty = rule.Type is "required" or "equalTo";
            if (empty && !runsOnEmpty) continue;

            if (!Passes(rule, v, empty, options, today))
                return new CheckResult(false, rule.Type, MessageFor(rule, options));
        }
        return new CheckResult(true, null, "");
    }

    public static CheckResult CheckValue(string? value, Rule rule, CheckOptions? options = null) => CheckValue(value, new[] { rule }, options);

    /// <summary>Checks a whole object (a JSON body, a model as a dictionary): <c>{ field: rules }</c>.</summary>
    public static ValuesResult CheckValues(IReadOnlyDictionary<string, string?> data, IReadOnlyDictionary<string, IReadOnlyList<Rule>> schema, CheckOptions? options = null)
    {
        options ??= new CheckOptions();
        var merged = new Dictionary<string, string?>();
        foreach (var kv in data) merged[kv.Key] = kv.Value;
        if (options.Values is not null) foreach (var kv in options.Values) merged[kv.Key] = kv.Value;
        var perField = new CheckOptions { Trim = options.Trim, Messages = options.Messages, Today = options.Today, Values = merged };

        var errors = new Dictionary<string, string>();
        var details = new Dictionary<string, CheckResult>();
        foreach (var entry in schema)
        {
            string field = entry.Key;
            data.TryGetValue(field, out var value);
            var r = CheckValue(value, entry.Value, perField);
            if (!r.Valid) { errors[field] = r.Message; details[field] = r; }
        }
        return new ValuesResult(errors.Count == 0, errors, details);
    }

    /// <summary>Reads rules from the very JSON the browser uses, for example <c>["required", {"type":"minlength","min":3}]</c>.</summary>
    public static IReadOnlyList<Rule> ParseRules(string json) => Rule.ParseList(json);

    // ------------------------------------------------------------------ engine
    // like the browser: required first when the rules are written as a map; as a list the order is kept
    static IEnumerable<Rule> Order(IEnumerable<Rule> rules) => rules;

    static bool Passes(Rule r, string v, bool empty, CheckOptions o, DateTime today)
    {
        switch (r.Type)
        {
            case "required": return !empty;
            case "email": return EmailRe.IsMatch(v);
            case "url":
                var protocols = r.Has("protocols") ? r.List("protocols").Select(p => p?.ToString() ?? "").ToList() : (IReadOnlyList<string>)DefaultProtocols;
                return UrlCheck.IsValid(v, r.Flag("requireProtocol"), r.Flag("allowLocal"), protocols);
            case "number": return Numbers.IsDecimal(v);
            case "digits": return DigitsRe.IsMatch(v);
            case "alpha": return JsText.CodePoints(v).All(x => JsText.IsLetter(x.Category));
            case "alphanumeric": return JsText.CodePoints(v).All(x => JsText.IsLetter(x.Category) || JsText.IsNumber(x.Category));
            case "phone": return Phone(v);
            case "date": return DateFormat.ValueOf(v, r.Str("format"), today) is not null;
            case "minDate":
            {
                var a = DateFormat.ValueOf(v, r.Str("format"), today); var b = DateFormat.ValueOf(r.Str("min") ?? "", r.Str("format"), today);
                return a is not null && b is not null && a >= b;
            }
            case "maxDate":
            {
                var a = DateFormat.ValueOf(v, r.Str("format"), today); var b = DateFormat.ValueOf(r.Str("max") ?? "", r.Str("format"), today);
                return a is not null && b is not null && a <= b;
            }
            case "creditcard": return Luhn(v);
            case "pattern": return Pattern(r, v);
            case "maxlength": return v.Length <= r.Num("max");
            case "minlength": return v.Length >= r.Num("min");
            case "rangelength": return v.Length >= r.Num("min") && v.Length <= r.Num("max");
            case "range": { var n = Numbers.Parse(v); return n >= r.Num("min") && n <= r.Num("max"); }
            case "max": return Numbers.Parse(v) <= r.Num("max");
            case "min": return Numbers.Parse(v) >= r.Num("min");
            case "step":
            {
                double n = Numbers.Parse(v), baseValue = r.Has("base") ? r.Num("base") : 0;
                if (double.IsNaN(n)) return false;
                double q = (n - baseValue) / r.Num("step");
                return Math.Abs(q - Math.Floor(q + 0.5)) < 1e-9;   // Math.Floor(q + 0.5) is JavaScript's Math.round
            }
            case "oneOf": return r.List("values").Select(x => x switch { double d => JsText.NumberToString(d), bool b => b ? "true" : "false", _ => x?.ToString() ?? "null" }).Contains(v, StringComparer.Ordinal);
            case "equalTo":
            {
                var other = Other(r, o);
                return v == JsText.Trim(other) || v == other;
            }
            case "notEqualTo":
            {
                var other = Other(r, o);
                return v != JsText.Trim(other) && v != other;
            }
            case "pwcheck": return PwCheck(r, v);
            case "custom":
                if (r.Predicate is null) throw new InvalidOperationException("A custom rule needs a predicate: Rule.Custom(isValid, message).");
                return r.Predicate(v);
            default:
                throw new NotSupportedException($"The \"{r.Type}\" rule is not available on the server (file, checkbox-count and remote rules need a browser form).");
        }
    }

    static string Other(Rule r, CheckOptions o)
    {
        string target = r.Str("target") ?? throw new InvalidOperationException($"The {r.Type} rule needs a target field.");
        if (o.Values is null || !o.Values.TryGetValue(target, out var other))
            throw new InvalidOperationException($"Pass the other field \"{target}\" in CheckOptions.Values for the {r.Type} rule.");
        return other ?? "";
    }

    static bool Phone(string v)
    {
        if (!PhoneChars.IsMatch(v)) return false;
        int digits = v.Count(c => c is >= '0' and <= '9');
        return digits is >= 7 and <= 15;
    }

    static bool Luhn(string v)
    {
        string s = StripCard.Replace(v, "");
        if (!CardRe.IsMatch(s)) return false;
        int sum = 0; bool alt = false;
        for (int i = s.Length - 1; i >= 0; i--) { int n = s[i] - '0'; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
        return sum % 10 == 0;
    }

    static bool Pattern(Rule r, string v)
    {
        string pattern = r.Str("pattern") ?? r.Str("regex") ?? "";
        string flags = r.Str("flags") ?? "";
        var opt = RegexOptions.CultureInvariant;
        if (flags.IndexOf('i') >= 0) opt |= RegexOptions.IgnoreCase;
        if (flags.IndexOf('m') >= 0) opt |= RegexOptions.Multiline;
        if (flags.IndexOf('s') >= 0) opt |= RegexOptions.Singleline;
        try { return new Regex(pattern, opt, RegexTimeout).IsMatch(v); }
        catch (RegexMatchTimeoutException) { return false; }
    }

    static bool PwCheck(Rule r, string v)
    {
        double minLength = r.Has("minLength") ? r.Num("minLength") : 6;
        if (r.Options.TryGetValue("enabled", out var en) && en is false) return true;
        if (v.Length < minLength) return false;
        if (r.Has("maxLength") && r.Num("maxLength") > 0 && v.Length > r.Num("maxLength")) return false;
        var runes = JsText.CodePoints(v).ToList();
        if (r.Flag("requireUppercase") && !runes.Any(x => x.Category == UnicodeCategory.UppercaseLetter)) return false;
        if (r.Flag("requireLowercase") && !runes.Any(x => x.Category == UnicodeCategory.LowercaseLetter)) return false;
        if (r.Flag("requireDigit") && !runes.Any(x => x.Category == UnicodeCategory.DecimalDigitNumber)) return false;
        if (r.Flag("requireSpecialChar") && !runes.Any(x => !JsText.IsLetter(x.Category) && !JsText.IsNumber(x.Category) && !(x.CodePoint <= 0xFFFF && JsText.IsWhiteSpace((char)x.CodePoint)))) return false;
        if (r.Flag("noWhitespace") && JsText.HasWhiteSpace(v)) return false;
        return true;
    }

    // ------------------------------------------------------------------ messages
    static string MessageFor(Rule r, CheckOptions o)
    {
        string text = r.Message
            ?? (o.Messages is not null && o.Messages.TryGetValue(r.Type, out var custom) ? custom : null)
            ?? (DefaultMessages.TryGetValue(r.Type, out var def) ? def : "Invalid value.");
        // {min}, {max}, {step}... from the rule's options, then {0}, {1} like the browser
        text = Regex.Replace(text, @"\{(\w+)\}", m =>
        {
            string key = m.Groups[1].Value;
            return char.IsDigit(key[0]) ? m.Value : r.Has(key) ? r.Str(key)! : m.Value;
        });
        var ps = Params(r);
        for (int i = 0; i < ps.Count; i++) text = text.Replace("{" + i.ToString(CultureInfo.InvariantCulture) + "}", ps[i]);
        return text;
    }

    static List<string> Params(Rule r)
    {
        if (r.Has("min") && r.Has("max")) return new() { r.Str("min")!, r.Str("max")! };
        if (r.Has("min")) return new() { r.Str("min")! };
        if (r.Has("max")) return new() { r.Str("max")! };
        if (r.Has("step")) return new() { r.Str("step")! };
        return new();
    }
}
