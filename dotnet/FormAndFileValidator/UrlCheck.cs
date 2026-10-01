using System.Globalization;
using System.Net;
using System.Net.Sockets;

namespace FormAndFileValidator;

/// <summary>
/// The url rule, answering like the JavaScript package (which asks the browser's WHATWG URL parser).
/// Covered: scheme, user info, port range, IPv4 and IPv6, internationalised host names, percent-encoding, forbidden host characters.
/// </summary>
internal static class UrlCheck
{
    static readonly HashSet<string> Special = new() { "http", "https", "ftp", "ws", "wss", "file" };
    const string ForbiddenHost = " #/:<>?@[\\]^|%";

    public static bool IsValid(string v, bool requireProtocol, bool allowLocal, IReadOnlyList<string> protocols)
    {
        if (JsText.HasWhiteSpace(v)) return false;

        int sep = v.IndexOf("://", StringComparison.Ordinal);
        bool hasProto = sep > 0 && IsScheme(v.Substring(0, sep));
        if (!hasProto && requireProtocol) return false;
        string full = hasProto ? v : "http://" + v;
        sep = full.IndexOf("://", StringComparison.Ordinal);
        string scheme = full.Substring(0, sep).ToLowerInvariant();
        if (!protocols.Contains(scheme + ":")) return false;

        string rest = full.Substring(sep + 3);
        bool special = Special.Contains(scheme);
        int end = rest.Length;
        for (int i = 0; i < rest.Length; i++)
            if (rest[i] is '/' or '?' or '#' || (special && rest[i] == '\\')) { end = i; break; }
        string authority = rest.Substring(0, end);

        int at = authority.LastIndexOf('@');
        string hostPort = at >= 0 ? authority.Substring(at + 1) : authority;

        string host, port = "";
        if (hostPort.Length > 0 && hostPort[0] == '[')
        {
            int close = hostPort.IndexOf(']');
            if (close < 0) return false;
            host = hostPort.Substring(0, close + 1);
            string after = hostPort.Substring(close + 1);
            if (after.Length > 0) { if (after[0] != ':') return false; port = after.Substring(1); }
            if (!IPAddress.TryParse(host.Substring(1, host.Length - 2), out var ip6) || ip6.AddressFamily != AddressFamily.InterNetworkV6) return false;
        }
        else
        {
            int colon = hostPort.IndexOf(':');
            host = colon >= 0 ? hostPort.Substring(0, colon) : hostPort;
            if (colon >= 0) port = hostPort.Substring(colon + 1);
            if (host.Length == 0) return false;
            host = Normalize(host);
            if (host.Length == 0) return false;
            foreach (char c in host) if (c <= (char)0x1f || c == (char)0x7f || ForbiddenHost.IndexOf(c) >= 0) return false;
            if (EndsInNumber(host)) { var ip = ParseIpv4(host); if (ip is null) return false; host = ip; }   // the URL standard: a host that ends in a number must be an IPv4 address
        }

        if (port.Length > 0)
        {
            foreach (char c in port) if (c is < '0' or > '9') return false;
            if (port.Length > 5 || int.Parse(port, CultureInfo.InvariantCulture) > 65535) return false;
        }

        if (allowLocal) return true;
        return (host.IndexOf('.') >= 0 || host == "localhost") && host[0] != '.' && host[host.Length - 1] != '.';
    }

    static bool IsScheme(string s)
    {
        if (s.Length == 0 || !((s[0] >= 'a' && s[0] <= 'z') || (s[0] >= 'A' && s[0] <= 'Z'))) return false;
        foreach (char c in s)
            if (!(c is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '+' or '.' or '-')) return false;
        return true;
    }

    /// <summary>Percent-decoding, lower case and the ASCII (punycode) form of an international name, like the URL standard does.</summary>
    static string Normalize(string host)
    {
        try
        {
            if (host.IndexOf('%') >= 0) host = Uri.UnescapeDataString(host);
            host = host.ToLowerInvariant();
            bool ascii = true;
            foreach (char c in host) if (c > '\u007f') { ascii = false; break; }
            return ascii ? host : new IdnMapping { AllowUnassigned = false, UseStd3AsciiRules = false }.GetAscii(host);
        }
        catch (Exception) { return ""; }
    }

    static bool EndsInNumber(string host)
    {
        var labels = host.TrimEnd('.').Split('.');
        string last = labels[labels.Length - 1];
        if (last.Length == 0) return false;
        if (last.All(c => c is >= '0' and <= '9')) return true;
        return last.StartsWith("0x", StringComparison.OrdinalIgnoreCase) && last.Skip(2).All(Uri.IsHexDigit);
    }

    /// <summary>The URL standard's IPv4 parser: 1 to 4 parts, each decimal, 0x hex or 0 octal; the last part fills the remaining bytes. Returns the dotted form.</summary>
    static string? ParseIpv4(string host)
    {
        var parts = host.Split('.').ToList();
        if (parts[parts.Count - 1].Length == 0 && parts.Count > 1) parts.RemoveAt(parts.Count - 1);
        if (parts.Count > 4) return null;
        var numbers = new List<long>();
        foreach (var p in parts)
        {
            var n = ParsePart(p);
            if (n is null) return null;
            numbers.Add(n.Value);
        }
        for (int i = 0; i < numbers.Count - 1; i++) if (numbers[i] > 255) return null;
        long lastMax = (long)Math.Pow(256, 5 - numbers.Count);
        if (numbers[numbers.Count - 1] >= lastMax) return null;
        long ipv4 = numbers[numbers.Count - 1];
        for (int i = 0; i < numbers.Count - 1; i++) ipv4 += numbers[i] * (long)Math.Pow(256, 3 - i);
        return $"{(ipv4 >> 24) & 255}.{(ipv4 >> 16) & 255}.{(ipv4 >> 8) & 255}.{ipv4 & 255}";
    }

    static long? ParsePart(string s)
    {
        if (s.Length == 0) return null;
        int radix = 10;
        if (s.Length >= 2 && s[0] == '0' && (s[1] == 'x' || s[1] == 'X')) { s = s.Substring(2); radix = 16; }
        else if (s.Length >= 2 && s[0] == '0') { s = s.Substring(1); radix = 8; }
        if (s.Length == 0) return 0;
        long value = 0;
        foreach (char c in s)
        {
            int digit = c is >= '0' and <= '9' ? c - '0' : c is >= 'a' and <= 'f' ? c - 'a' + 10 : c is >= 'A' and <= 'F' ? c - 'A' + 10 : 99;
            if (digit >= radix) return null;
            value = value * radix + digit;
            if (value > 0xFFFFFFFFL * 256) return null;
        }
        return value;
    }
}
