using System.ComponentModel.DataAnnotations;
using Xunit;

namespace FormAndFileValidator.Tests;

public class ApiTests
{
    class Signup
    {
        [FormRules("[\"required\", \"email\"]")]
        public string? Email { get; set; }

        [FormRules("[\"required\", {\"type\":\"pwcheck\",\"minLength\":8,\"requireUppercase\":true,\"requireDigit\":true}]")]
        public string? Password { get; set; }

        [FormRules("[{\"type\":\"equalTo\",\"target\":\"Password\"}]")]
        public string? ConfirmPassword { get; set; }

        [FormRules("[\"required\", {\"type\":\"date\",\"format\":\"d/M/y\"}, {\"type\":\"maxDate\",\"format\":\"d/M/y\",\"max\":\"today\"}]")]
        public string? BirthDate { get; set; }

        public string? NoRules { get; set; }
    }

    static IList<ValidationResult> Validate(object model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void Model_attributes_validate_like_DataAnnotations_and_fill_ModelState_style_results()
    {
        var ok = new Signup { Email = "a@b.co", Password = "Abcdefg1", ConfirmPassword = "Abcdefg1", BirthDate = "29/2/2000" };
        Assert.Empty(Validate(ok));

        var bad = new Signup { Email = "a@b", Password = "abc", ConfirmPassword = "abd", BirthDate = "31/4/2000" };
        var results = Validate(bad);
        Assert.Equal(new[] { "BirthDate", "ConfirmPassword", "Email", "Password" }, results.SelectMany(r => r.MemberNames).OrderBy(x => x).ToArray());
        Assert.Equal("Please enter a valid email address.", results.Single(r => r.MemberNames.Contains("Email")).ErrorMessage);
        Assert.Equal("Values do not match.", results.Single(r => r.MemberNames.Contains("ConfirmPassword")).ErrorMessage);
    }

    [Fact]
    public void A_custom_ErrorMessage_wins()
    {
        var a = new FormRulesAttribute("[\"required\"]") { ErrorMessage = "Pflichtfeld" };
        var r = a.GetValidationResult("", new ValidationContext(new object()));
        Assert.Equal("Pflichtfeld", r!.ErrorMessage);
    }

    [Fact]
    public void ModelRules_gives_the_browser_the_same_definition()
    {
        string json = ModelRules.ToJson<Signup>();
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        Assert.Equal(new[] { "BirthDate", "ConfirmPassword", "Email", "Password" }, doc.RootElement.EnumerateObject().Select(p => p.Name).OrderBy(x => x).ToArray());
        Assert.Contains("\"format\":\"d/M/y\"", json);
        Assert.Equal(4, ModelRules.For<Signup>().Count);
    }

    [Fact]
    public void InitScript_is_valid_and_safe_inside_a_script_element()
    {
        string script = ModelRules.InitScript(typeof(Signup), "signup\"</script>");
        Assert.StartsWith("FormValidator.init({ formId: ", script);
        Assert.DoesNotContain("<", script);
        Assert.DoesNotContain(">", script);
        Assert.Contains("rules: {", script);
    }

    [Fact]
    public void CheckValues_reports_each_field_and_uses_the_other_fields()
    {
        var data = new Dictionary<string, string?> { ["pw"] = "Secret1!", ["pw2"] = "Secret1?", ["n"] = "9" };
        var schema = new Dictionary<string, IReadOnlyList<Rule>>
        {
            ["pw2"] = new[] { Rule.EqualTo("pw") },
            ["n"] = new[] { Rule.Range(1, 5) },
        };
        var r = FormValidator.CheckValues(data, schema);
        Assert.False(r.Valid);
        Assert.Equal("Values do not match.", r.Errors["pw2"]);
        Assert.Equal("Please enter a value between 1 and 5.", r.Errors["n"]);
    }

    [Fact]
    public void Json_rules_and_code_rules_agree_and_the_map_shorthand_works()
    {
        var fromJson = FormValidator.ParseRules("{\"required\":true,\"minlength\":3,\"range\":[1,5]}");
        Assert.Equal(new[] { "required", "minlength", "range" }, fromJson.Select(x => x.Type).ToArray());
        Assert.False(FormValidator.CheckValue("ab", fromJson).Valid);
        Assert.True(FormValidator.CheckValue("5", new[] { Rule.Required(), Rule.MinLength(1), Rule.Range(1, 5) }).Valid);
    }

    [Fact]
    public void Messages_can_be_replaced_and_fill_placeholders()
    {
        var r = FormValidator.CheckValue("ab", Rule.MinLength(3));
        Assert.Equal("Please enter at least 3 characters.", r.Message);
        var de = FormValidator.CheckValue("ab", Rule.MinLength(3), new CheckOptions { Messages = new Dictionary<string, string> { ["minlength"] = "Mindestens {0} Zeichen." } });
        Assert.Equal("Mindestens 3 Zeichen.", de.Message);
    }

    [Fact]
    public void Custom_rules_when_and_blank_handling()
    {
        var even = Rule.Custom(v => int.Parse(v) % 2 == 0, "Even numbers only");
        Assert.Equal("Even numbers only", FormValidator.CheckValue("3", even).Message);
        Assert.True(FormValidator.CheckValue("", even).Valid);                       // blank skips everything except required
        Assert.False(FormValidator.CheckValue("  ", Rule.Required()).Valid);
        var conditional = new Rule("minlength", new Dictionary<string, object?> { ["min"] = 5.0 }) { When = v => v.StartsWith("x") };
        Assert.True(FormValidator.CheckValue("ab", conditional).Valid);              // when() says the rule does not apply
        Assert.False(FormValidator.CheckValue("xb", conditional).Valid);
    }

    [Fact]
    public void Today_is_injectable_for_tests_and_means_the_calendar_date()
    {
        var rules = new[] { Rule.MaxDate("today", "d/M/y") };
        var o = new CheckOptions { Today = () => new DateTime(2024, 6, 15, 23, 59, 0) };
        Assert.True(FormValidator.CheckValue("15/6/2024", rules, o).Valid);
        Assert.False(FormValidator.CheckValue("16/6/2024", rules, o).Valid);
    }

    [Fact]
    public void Rules_that_need_a_browser_form_say_so()
    {
        Assert.Throws<NotSupportedException>(() => FormValidator.CheckValue("x", new Rule("fileType")));
        Assert.Throws<InvalidOperationException>(() => FormValidator.CheckValue("x", Rule.EqualTo("other")));   // the other field was not passed
    }

    [Fact]
    public void A_pattern_that_takes_too_long_fails_instead_of_hanging()
    {
        var evil = Rule.Pattern("^(a+)+$");
        var started = DateTime.UtcNow;
        var r = FormValidator.CheckValue(new string('a', 40) + "!", evil);
        Assert.False(r.Valid);
        Assert.True(DateTime.UtcNow - started < TimeSpan.FromSeconds(10));
    }
}
