using System.Text.RegularExpressions;

namespace FormAndFileValidator;

/// <summary>
/// Dates with an explicit format, identical to the JavaScript package (no guessing).
/// Tokens: yyyy / y (4-digit year), yy (00-69 = 20xx, 70-99 = 19xx), MM / M, dd / d, HH / H, mm / m, ss / s; every other character is literal.
/// d / M / H / m / s accept 1 or 2 digits, the doubled tokens need exactly 2. The calendar is checked (leap years, 30/31-day months).
/// </summary>
internal static class DateFormat
{
    static readonly Regex Token = new("yyyy|yy|y|MM|M|dd|d|HH|H|mm|m|ss|s", RegexOptions.CultureInvariant);
    static readonly string[] IsoFormats = { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss" };

    static int DaysIn(int y, int m) =>
        m == 2 ? ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0 ? 29 : 28) : m is 4 or 6 or 9 or 11 ? 30 : 31;

    /// <summary>The wall-clock date and time as ticks, or null when the text does not fit the format.</summary>
    public static long? Parse(string v, string format)
    {
        int pos = 0, last = 0;
        int? y = null; int M = 1, d = 1, H = 0, m = 0, s = 0;

        int? Digits(int min, int max)
        {
            int n = 0;
            while (n < max && pos + n < v.Length && v[pos + n] is >= '0' and <= '9') n++;
            if (n < min) return null;
            int value = int.Parse(v.AsSpan(pos, n), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture);
            pos += n;
            return value;
        }
        bool Lit(string text)
        {
            if (string.CompareOrdinal(v, pos, text, 0, text.Length) != 0 || pos + text.Length > v.Length) return false;
            pos += text.Length;
            return true;
        }

        foreach (Match t in Token.Matches(format))
        {
            if (t.Index > last && !Lit(format.Substring(last, t.Index - last))) return null;
            last = t.Index + t.Length;
            string tok = t.Value;
            int? n = tok is "yyyy" or "y" ? Digits(4, 4) : tok.Length == 2 ? Digits(2, 2) : Digits(1, 2);
            if (n is null) return null;
            switch (tok)
            {
                case "yyyy": case "y": y = n; break;
                case "yy": y = n < 70 ? 2000 + n : 1900 + n; break;
                case "MM": case "M": M = n.Value; break;
                case "dd": case "d": d = n.Value; break;
                case "HH": case "H": H = n.Value; break;
                case "mm": case "m": m = n.Value; break;
                default: s = n.Value; break;
            }
        }
        if (last < format.Length && !Lit(format.Substring(last))) return null;
        if (pos != v.Length || y is null || y < 1) return null;
        if (M < 1 || M > 12 || d < 1 || d > DaysIn(y.Value, M) || H > 23 || m > 59 || s > 59) return null;
        return new DateTime(y.Value, M, d, H, m, s, DateTimeKind.Utc).Ticks;
    }

    /// <summary>Strict ISO 8601: yyyy-MM-dd, optionally with THH:mm[:ss]; no time zone, no other spellings.</summary>
    public static long? ParseIso(string v)
    {
        foreach (var f in IsoFormats) { var t = Parse(v, f); if (t is not null) return t; }
        return null;
    }

    /// <summary>The value of a date rule: an explicit format, otherwise strict ISO 8601. "today" is the current calendar date.</summary>
    public static long? ValueOf(string v, string? format, DateTime today)
    {
        if (v == "today") return new DateTime(today.Year, today.Month, today.Day, 0, 0, 0, DateTimeKind.Utc).Ticks;
        return format is not null ? Parse(v, format) : ParseIso(v);
    }
}
