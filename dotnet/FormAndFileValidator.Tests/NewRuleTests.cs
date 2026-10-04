using Xunit;

namespace FormAndFileValidator.Tests;

/// <summary>Messages, factories and the JSON shorthand of the rules added in 2.8.0 (pass / fail answers are in the shared vectors).</summary>
public class NewRuleTests
{
    [Fact]
    public void Messages_fill_their_placeholders_like_the_browser()
    {
        Assert.Equal("Must start with AB.", FormValidator.CheckValue("x", Rule.StartsWith("AB")).Message);
        Assert.Equal("Must end with .pdf.", FormValidator.CheckValue("x", Rule.EndsWith(".pdf")).Message);
        Assert.Equal("Must contain z.", FormValidator.CheckValue("x", Rule.Contains("z")).Message);
        Assert.Equal("Please enter at least 3 words.", FormValidator.CheckValue("a b", Rule.MinWords(3)).Message);
        Assert.Equal("Please enter no more than 2 words.", FormValidator.CheckValue("a b c", Rule.MaxWords(2)).Message);
        Assert.Equal("Please enter a valid UUID.", FormValidator.CheckValue("x", Rule.Uuid()).Message);
        Assert.Equal("This value is not allowed.", FormValidator.CheckValue("admin", Rule.NotOneOf("admin")).Message);
    }

    [Fact]
    public void The_JSON_rules_of_the_browser_work_for_every_new_rule()
    {
        var rules = FormValidator.ParseRules("""["required", "slug", {"type":"minWords","min":1}]""");
        Assert.True(FormValidator.CheckValue("hello-world", rules).Valid);
        Assert.Equal("slug", FormValidator.CheckValue("Hello", rules).Rule);

        var shorthand = FormValidator.ParseRules("""{"startsWith":"AB","endsWith":"Z","contains":"-","notOneOf":["ABC-Z"],"maxWords":1}""");
        Assert.True(FormValidator.CheckValue("AB-Z", shorthand).Valid);
        Assert.Equal("notOneOf", FormValidator.CheckValue("ABC-Z", shorthand).Rule);
        Assert.Equal("startsWith", FormValidator.CheckValue("XB-Z", shorthand).Rule);
    }

    [Fact]
    public void Blank_values_skip_the_new_rules()
    {
        foreach (var rule in new[] { Rule.Integer(), Rule.Uuid(), Rule.HexColor(), Rule.Slug(), Rule.Ipv4(), Rule.Ipv6(), Rule.Iban(), Rule.Time(), Rule.Domain(), Rule.Base64(), Rule.Mac(), Rule.Latitude(), Rule.Longitude(), Rule.StartsWith("x"), Rule.MinWords(3) })
            Assert.True(FormValidator.CheckValue("", rule).Valid, rule.Type);
    }

    [Fact]
    public void Attributes_accept_the_new_rules()
    {
        var m = new Model { Ip = "999.1.1.1", Iban = "DE89 3704 0044 0532 0130 00" };
        var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        System.ComponentModel.DataAnnotations.Validator.TryValidateObject(m, new System.ComponentModel.DataAnnotations.ValidationContext(m), results, true);
        Assert.Equal(new[] { "Ip" }, results.SelectMany(r => r.MemberNames).ToArray());
        Assert.Equal("Please enter a valid IPv4 address.", results[0].ErrorMessage);
    }

    sealed class Model
    {
        [FormRules("""["required","ipv4"]""")] public string? Ip { get; set; }
        [FormRules("""["iban"]""")] public string? Iban { get; set; }
    }
}
