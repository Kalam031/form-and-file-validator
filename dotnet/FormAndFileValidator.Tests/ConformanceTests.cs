using System.Text.Json;
using Xunit;

namespace FormAndFileValidator.Tests;

/// <summary>The .NET port must give exactly the answers of spec/form-rules.vectors.json, the file the JavaScript package is tested with.</summary>
public class ConformanceTests
{
    [Fact]
    public void Every_vector_gets_the_same_answer_as_in_JavaScript()
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "form-rules.vectors.json")));
        var cases = doc.RootElement.GetProperty("cases").EnumerateArray().ToList();
        Assert.True(cases.Count > 300, "the vectors file should have more than 300 cases");

        var mismatches = new List<string>();
        foreach (var c in cases)
        {
            var rules = Rule.FromJson(c.GetProperty("rule"));
            string value = c.GetProperty("value").GetString()!;
            bool expected = c.GetProperty("valid").GetBoolean();
            var others = new Dictionary<string, string?>();
            if (c.TryGetProperty("values", out var vs)) foreach (var p in vs.EnumerateObject()) others[p.Name] = p.Value.GetString();

            CheckResult r;
            try { r = FormValidator.CheckValue(value, rules, new CheckOptions { Values = others, Today = () => new DateTime(2024, 6, 15) }); }
            catch (Exception e) { mismatches.Add($"{c.GetProperty("rule")} on {JsonSerializer.Serialize(value)}: threw {e.GetType().Name}: {e.Message}"); continue; }

            bool ruleOk = !c.TryGetProperty("failedRule", out var fr) || r.Rule == fr.GetString();
            bool msgOk = r.Valid ? r.Message == "" : r.Message.Length > 0 && r.Rule is not null;
            if (r.Valid != expected || !ruleOk || !msgOk)
                mismatches.Add($"{c.GetProperty("rule")} on {JsonSerializer.Serialize(value)}: expected {(expected ? "valid" : "invalid")}, got {(r.Valid ? "valid" : "invalid")} ({r.Rule})");
        }
        Assert.True(mismatches.Count == 0, $"{mismatches.Count} of {cases.Count} vectors differ from JavaScript:\n" + string.Join("\n", mismatches.Take(40)));
    }
}
