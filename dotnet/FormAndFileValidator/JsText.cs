using System.Globalization;
using System.Text;

namespace FormAndFileValidator;

/// <summary>
/// Text helpers that behave exactly like JavaScript, so a value is judged the same on the server and in the browser.
/// </summary>
internal static class JsText
{
    // The characters JavaScript treats as whitespace (String.prototype.trim and the \s class), written as code points.
    // NOT whitespace in JavaScript although char.IsWhiteSpace says so: U+0085 (NEL). Whitespace in JavaScript but not in .NET: U+FEFF.
    public static bool IsWhiteSpace(char c)
    {
        int n = c;
        return n is 0x09 or 0x0A or 0x0B or 0x0C or 0x0D or 0x20 or 0xA0 or 0x1680
            or (>= 0x2000 and <= 0x200A) or 0x2028 or 0x2029 or 0x202F or 0x205F or 0x3000 or 0xFEFF;
    }

    /// <summary>The same set as the body of a regex character class (\s in JavaScript), built from the code points above.</summary>
    public static readonly string WsClass = BuildWsClass();

    static string BuildWsClass()
    {
        var sb = new StringBuilder();
        for (int i = 0; i <= 0xFFFF; i++)
        {
            if (!IsWhiteSpace((char)i)) continue;
            sb.Append((char)92).Append('u').Append(i.ToString("x4", CultureInfo.InvariantCulture));
        }
        return sb.ToString();
    }

    public static string Trim(string s)
    {
        int start = 0, end = s.Length;
        while (start < end && IsWhiteSpace(s[start])) start++;
        while (end > start && IsWhiteSpace(s[end - 1])) end--;
        return start == 0 && end == s.Length ? s : s.Substring(start, end - start);
    }

    public static bool HasWhiteSpace(string s)
    {
        foreach (var c in s) if (IsWhiteSpace(c)) return true;
        return false;
    }

    public static bool IsLetter(UnicodeCategory c) =>
        c is UnicodeCategory.UppercaseLetter or UnicodeCategory.LowercaseLetter or UnicodeCategory.TitlecaseLetter
          or UnicodeCategory.ModifierLetter or UnicodeCategory.OtherLetter;

    public static bool IsNumber(UnicodeCategory c) =>
        c is UnicodeCategory.DecimalDigitNumber or UnicodeCategory.LetterNumber or UnicodeCategory.OtherNumber;

    /// <summary>Every code point (not UTF-16 unit) of the text with its Unicode category. The same code on every .NET version, including .NET Framework.</summary>
    public static IEnumerable<(int CodePoint, UnicodeCategory Category)> CodePoints(string s)
    {
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (char.IsHighSurrogate(c) && i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))
            {
                yield return (char.ConvertToUtf32(c, s[i + 1]), CharUnicodeInfo.GetUnicodeCategory(s, i));
                i++;
            }
            else yield return (c, char.IsSurrogate(c) ? UnicodeCategory.Surrogate : CharUnicodeInfo.GetUnicodeCategory(c));
        }
    }

    /// <summary>JavaScript's String(number): 5 not 5.0, no exponent for ordinary sizes.</summary>
    public static string NumberToString(double d)
    {
        if (double.IsNaN(d)) return "NaN";
        if (double.IsInfinity(d)) return d > 0 ? "Infinity" : "-Infinity";
        if (d == Math.Floor(d) && Math.Abs(d) < 1e21) return d.ToString("0", CultureInfo.InvariantCulture);
        return d.ToString("R", CultureInfo.InvariantCulture);
    }
}
