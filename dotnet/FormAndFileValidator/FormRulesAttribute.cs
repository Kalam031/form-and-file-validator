#nullable disable
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace FormAndFileValidator;

/// <summary>
/// Puts the form rules on a model property, so ONE definition drives the server (ModelState / DataAnnotations in ASP.NET MVC 5, ASP.NET Core MVC,
/// Blazor) and the browser (<see cref="ModelRules.ToJson(Type)"/> gives the very JSON the JavaScript FormValidator reads).
/// <code>
/// [FormRules("""["required", "email"]""")]                       public string Email { get; set; }
/// [FormRules("""[{"type":"date","format":"d/M/y"}]""")]           public string BirthDate { get; set; }   // keep dates as the text the user typed
/// [FormRules("""[{"type":"equalTo","target":"Password"}]""")]     public string ConfirmPassword { get; set; }
/// </code>
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed class FormRulesAttribute : ValidationAttribute
{
    readonly IReadOnlyList<Rule> _rules;

    /// <param name="rulesJson">The rules as the browser reads them: <c>["required","email"]</c>, <c>{"type":"minlength","min":3}</c>, or a list of both.</param>
    public FormRulesAttribute(string rulesJson)
    {
        RulesJson = rulesJson ?? throw new ArgumentNullException(nameof(rulesJson));
        _rules = Rule.ParseList(rulesJson);
    }

    /// <summary>The JSON exactly as written.</summary>
    public string RulesJson { get; }

    public IReadOnlyList<Rule> Rules => _rules;

    protected override ValidationResult IsValid(object value, ValidationContext validationContext)
    {
        var result = FormValidator.CheckValue(Text(value), _rules, new CheckOptions { Values = OtherFields(validationContext?.ObjectInstance) });
        if (result.Valid) return ValidationResult.Success;
        string message = ErrorMessage ?? result.Message;
        return validationContext?.MemberName is null ? new ValidationResult(message) : new ValidationResult(message, new[] { validationContext.MemberName });
    }

    static string Text(object value) => value switch
    {
        null => null,
        string s => s,
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => value.ToString()
    };

    static IReadOnlyDictionary<string, string> OtherFields(object model)
    {
        var values = new Dictionary<string, string>();
        if (model is null) return values;
        foreach (var p in model.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (p.GetIndexParameters().Length > 0 || !p.CanRead) continue;
            try { values[p.Name] = Text(p.GetValue(model)); } catch (Exception) { /* a property that throws is simply not available to equalTo */ }
        }
        return values;
    }
}

/// <summary>Reads the <see cref="FormRulesAttribute"/>s of a model class: for server checks outside MVC, and as JSON for the browser.</summary>
public static class ModelRules
{
    /// <summary>The rules of each property that has [FormRules], keyed by property name (which is the form field name in MVC).</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<Rule>> For(Type model)
    {
        var map = new Dictionary<string, IReadOnlyList<Rule>>();
        foreach (var p in model.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var a = (FormRulesAttribute)Attribute.GetCustomAttribute(p, typeof(FormRulesAttribute), true);
            if (a != null) map[p.Name] = a.Rules;
        }
        return map;
    }

    public static IReadOnlyDictionary<string, IReadOnlyList<Rule>> For<T>() => For(typeof(T));

    /// <summary>
    /// <c>{"Email":["required","email"],"BirthDate":[{"type":"date","format":"d/M/y"}]}</c>: the rules object for <c>FormValidator.init({ form, rules })</c>
    /// in the browser, built from the same attributes the server validates with.
    /// </summary>
    public static string ToJson(Type model)
    {
        var sb = new StringBuilder("{");
        bool first = true;
        foreach (var p in model.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            var a = (FormRulesAttribute)Attribute.GetCustomAttribute(p, typeof(FormRulesAttribute), true);
            if (a == null) continue;
            if (!first) sb.Append(',');
            first = false;
            sb.Append(JsonSerializer.Serialize(p.Name)).Append(':').Append(a.RulesJson);
        }
        return sb.Append('}').ToString();
    }

    public static string ToJson<T>() => ToJson(typeof(T));

    /// <summary>
    /// The JavaScript that sets the browser up with the same rules: <c>FormValidator.init({ formId: "signup", rules: {...} });</c>
    /// Safe to put inside a script element (angle brackets and ampersands are escaped).
    /// </summary>
    /// <param name="model">The model class with [FormRules] properties.</param>
    /// <param name="formId">The id of the form element.</param>
    /// <param name="configScript">
    /// Optional JavaScript object for the validator <c>config</c>, written by you (trusted code, it is not escaped), for example
    /// <c>"{ onSubmit: window.sendSignup }"</c> for an AJAX submit. Leave it out for a normal (direct) submit.
    /// </param>
    public static string InitScript(Type model, string formId, string configScript = null)
    {
        char bs = (char)92;
        // escape only what we generate from data (the form id and the rule JSON); the config is your own JavaScript
        string head = ("FormValidator.init({ formId: " + JsonSerializer.Serialize(formId) + ", rules: " + ToJson(model))
            .Replace("<", bs + "u003c").Replace(">", bs + "u003e").Replace("&", bs + "u0026");
        return head + (string.IsNullOrWhiteSpace(configScript) ? "" : ", config: " + configScript) + " });";
    }
}
