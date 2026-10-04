using System.Text;
using System.Text.RegularExpressions;

namespace FormAndFileValidator;

/// <summary>Looks inside PDF, Office and ZIP files and reads image sizes from the file header (no decoding, no image library).</summary>
internal static class FileInspect
{
    private static readonly Dictionary<string, string> OoxmlPrefix = new Dictionary<string, string>
    {
        [".docx"] = "word/", [".docm"] = "word/", [".dotx"] = "word/", [".dotm"] = "word/",
        [".xlsx"] = "xl/", [".xlsm"] = "xl/", [".xltx"] = "xl/", [".xltm"] = "xl/", [".xlam"] = "xl/",
        [".pptx"] = "ppt/", [".pptm"] = "ppt/", [".potx"] = "ppt/", [".potm"] = "ppt/", [".ppsx"] = "ppt/", [".ppsm"] = "ppt/", [".ppam"] = "ppt/",
    };
    private static readonly string[] MacroExts = { ".docm", ".dotm", ".xlsm", ".xltm", ".xlam", ".pptm", ".potm", ".ppsm", ".ppam" };
    private static readonly string[] OdfExts = { ".odt", ".ods", ".odp" };
    private static readonly string[] OleDocExts = { ".doc", ".dot", ".xls", ".xlt", ".ppt", ".pps", ".pot" };

    private static readonly Regex ExecName = new Regex(@"\.(exe|dll|bat|cmd|vbs|vbe|js|jse|jar|scr|msi|ps1|com|hta|lnk|wsf)$", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex UnsafePath = new Regex(@"(^|[\\/])\.\.([\\/]|$)", RegexOptions.ECMAScript);
    private static readonly Regex DriveLetter = new Regex(@"^[a-z]:", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex VbaProject = new Regex(@"(^|/)vbaProject\.bin$", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex OdfScripts = new Regex(@"^(Basic|Scripts)/", RegexOptions.ECMAScript);
    private static readonly Regex ActiveX = new Regex(@"(^|/)activeX/", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex Embedded = new Regex(@"(^|/)(embeddings|Object \d+)/", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex PdfScript = new Regex(@"/(JavaScript|JS)\b", RegexOptions.ECMAScript);
    private static readonly Regex PdfLaunch = new Regex(@"/Launch\b", RegexOptions.ECMAScript);
    private static readonly Regex PdfEmbeddedFile = new Regex(@"/EmbeddedFile\b", RegexOptions.ECMAScript);
    private static readonly Regex PdfEmbeddedExe = new Regex(@"/(F|UF)\s*\(([^)]*\.(exe|dll|bat|cmd|vbs|js|jar|scr|msi|ps1|com|hta))\)", RegexOptions.IgnoreCase | RegexOptions.ECMAScript);
    private static readonly Regex HashEscape = new Regex(@"#([0-9a-fA-F]{2})", RegexOptions.ECMAScript);

    private static int U16(byte[] b, int o) => (o < b.Length ? b[o] : 0) | ((o + 1 < b.Length ? b[o + 1] : 0) << 8);
    private static uint U32(byte[] b, int o) => FileSignatures.U32(b, o);
    private static string Latin1(byte[] b) => Encoding.GetEncoding("iso-8859-1").GetString(b);

    internal delegate void Add(string code, params (string Key, string Value)[] parameters);

    /// <summary>Adds problems found inside the file through <paramref name="add"/>.</summary>
    internal static void Document(UploadedFile file, string ext, FileSignature sig, FileValidatorOptions cfg, Add add, bool explicitlyAllowed)
    {
        var d = cfg.DocumentChecks;
        void Dangerous(string detected) => add("DANGEROUS_CONTENT", ("detected", detected));

        if (sig.Name == "zip")
        {
            string kind = OoxmlPrefix.ContainsKey(ext) ? "Office document" : (OdfExts.Contains(ext) ? "document" : "ZIP archive");
            var z = ReadZip(file);
            if (!z.Ok) { if (d.CheckStructure) add("CORRUPT_FILE", ("kind", kind), ("reason", z.Reason!)); return; }
            var names = z.Entries.Select(e => e.Name).ToList();
            if (d.BlockUnsafePaths && names.Any(n => UnsafePath.IsMatch(n) || (n.Length > 0 && n[0] == '/') || DriveLetter.IsMatch(n))) Dangerous("unsafe file paths inside the archive");
            double usize = z.Entries.Sum(e => (double)e.USize), csize = z.Entries.Sum(e => (double)e.CSize);
            if (z.Entries.Count > d.MaxEntries) add("ARCHIVE_BOMB", ("reason", "it holds " + z.Entries.Count + " files"));
            else if (usize > d.MaxUncompressedMB * 1048576.0) add("ARCHIVE_BOMB", ("reason", "it would expand to " + FileValidator.FormatBytes(usize)));
            else if (csize > 0 && usize > 50 * 1048576.0 && usize / csize > d.MaxCompressionRatio)
                add("ARCHIVE_BOMB", ("reason", "it compresses " + Js.Round(usize / csize) + " times, which is not normal for a real document"));

            OoxmlPrefix.TryGetValue(ext, out var prefix);
            if (prefix != null && d.CheckStructure && z.Skipped == null && (!names.Contains("[Content_Types].xml") || !names.Any(n => n.StartsWith(prefix, StringComparison.Ordinal))))
                add("CORRUPT_FILE", ("kind", kind), ("reason", "required parts are missing, so it is not a real " + ext.Substring(1).ToUpperInvariant() + " file"));
            if (d.BlockMacros && !(explicitlyAllowed && MacroExts.Contains(ext)))
            {
                bool macro = (prefix != null || ext == ".xlam") && names.Any(n => VbaProject.IsMatch(n));
                bool odfMacro = OdfExts.Contains(ext) && names.Any(n => OdfScripts.IsMatch(n));
                if (macro || odfMacro) Dangerous("macros");
            }
            if (d.BlockEmbeddedPrograms && (prefix != null || OdfExts.Contains(ext)) && names.Any(n => ActiveX.IsMatch(n) || (Embedded.IsMatch(n) && ExecName.IsMatch(n)))) Dangerous("embedded programs");
            return;
        }

        if (sig.Name == "pdf")
        {
            long size = file.Length, cap = d.MaxScanMB * 1048576L;
            string tail = Latin1(file.ReadRange(Math.Max(0, size - 2048), size));
            if (d.CheckStructure && tail.IndexOf("%%EOF", StringComparison.Ordinal) < 0)
            {
                add("CORRUPT_FILE", ("kind", "PDF"), ("reason", "the end of the file is missing (it may be cut off)"));
                return;
            }
            string raw = size <= cap
                ? Latin1(file.ReadRange(0, size))
                : Latin1(file.ReadRange(0, cap / 2)) + Latin1(file.ReadRange(size - cap / 2, size));
            string text = HashEscape.Replace(raw, m => ((char)Convert.ToInt32(m.Groups[1].Value, 16)).ToString());   // /J#61vaScript -> /JavaScript
            if (d.BlockPdfJavaScript && PdfScript.IsMatch(text)) Dangerous("JavaScript in a PDF");
            else if (d.BlockPdfLaunch && PdfLaunch.IsMatch(text)) Dangerous("a launch action in a PDF");
            else if (d.BlockEmbeddedPrograms && PdfEmbeddedFile.IsMatch(text) && PdfEmbeddedExe.IsMatch(text)) Dangerous("an embedded program in a PDF");
            return;
        }

        if (sig.Name == "ole" && d.BlockMacros && OleDocExts.Contains(ext) && !(explicitlyAllowed && MacroExts.Contains(ext)))
        {
            var bytes = file.ReadRange(0, Math.Min(file.Length, d.MaxScanMB * 1048576L));
            if (IndexOfUtf16(bytes, "_VBA_PROJECT") >= 0 ||
                (IndexOfUtf16(bytes, "VBA") >= 0 && IndexOfUtf16(bytes, "dir") >= 0 && IndexOfUtf16(bytes, "Macros") >= 0)) Dangerous("macros");
        }
    }

    private static int IndexOfUtf16(byte[] hay, string text)
    {
        var needle = new byte[text.Length * 2];
        for (int i = 0; i < text.Length; i++) { needle[i * 2] = (byte)text[i]; needle[i * 2 + 1] = 0; }
        for (int i = 0; i <= hay.Length - needle.Length; i++)
        {
            int j = 0;
            while (j < needle.Length && hay[i + j] == needle[j]) j++;
            if (j == needle.Length) return i;
        }
        return -1;
    }

    // ------------------------------------------------------------------ ZIP central directory (no decompression)
    internal sealed class ZipEntry
    {
        public string Name = "";
        public uint CSize, USize;
    }

    internal sealed class ZipInfo
    {
        public bool Ok;
        public string? Reason;
        public string? Skipped;
        public List<ZipEntry> Entries = new List<ZipEntry>();
    }

    internal static ZipInfo ReadZip(UploadedFile file)
    {
        long size = file.Length;
        if (size < 22) return new ZipInfo { Reason = "the file is too short" };
        long tailLen = Math.Min(size, 65557);
        var tail = file.ReadRange(size - tailLen, size);
        int eocd = -1;
        for (int i = tail.Length - 22; i >= 0; i--)
        {
            if (tail[i] == 0x50 && tail[i + 1] == 0x4b && tail[i + 2] == 5 && tail[i + 3] == 6 && i + 22 + U16(tail, i + 20) <= tail.Length) { eocd = i; break; }
        }
        if (eocd < 0) return new ZipInfo { Reason = "the ZIP directory at the end of the file is missing (the file may be cut off)" };
        int count = U16(tail, eocd + 10);
        uint cdSize = U32(tail, eocd + 12), cdOff = U32(tail, eocd + 16);
        if (count == 0xffff || cdSize == 0xffffffff || cdOff == 0xffffffff) return new ZipInfo { Ok = true, Skipped = "zip64" };
        if ((long)cdOff + cdSize > size) return new ZipInfo { Reason = "the ZIP directory points outside the file" };
        if (cdSize > 32 * 1048576) return new ZipInfo { Ok = true, Skipped = "large" };
        var cd = file.ReadRange(cdOff, (long)cdOff + cdSize);
        var entries = new List<ZipEntry>();
        int pos = 0;
        var utf8 = new UTF8Encoding(false, false);
        while (pos + 46 <= cd.Length && entries.Count < count)
        {
            if (U32(cd, pos) != 0x02014b50) break;
            int nameLen = U16(cd, pos + 28), extraLen = U16(cd, pos + 30), commentLen = U16(cd, pos + 32);
            int nameEnd = Math.Min(cd.Length, pos + 46 + nameLen);
            entries.Add(new ZipEntry { Name = utf8.GetString(cd, pos + 46, nameEnd - (pos + 46)), CSize = U32(cd, pos + 20), USize = U32(cd, pos + 24) });
            pos += 46 + nameLen + extraLen + commentLen;
        }
        if (entries.Count != count) return new ZipInfo { Reason = "the ZIP directory is damaged" };
        return new ZipInfo { Ok = true, Entries = entries };
    }

    // ------------------------------------------------------------------ image size from the header
    /// <summary>Width and height of a PNG, JPEG, GIF, WebP or BMP, or null when the header is damaged.</summary>
    internal static (int Width, int Height)? ImageSize(UploadedFile file, string sigName)
    {
        switch (sigName)
        {
            case "png":
            {
                var b = file.ReadRange(0, 24);
                if (b.Length < 24 || !FileSignatures.Ascii(b, 12, "IHDR")) return null;
                long w = (long)U32Be(b, 16), h = U32Be(b, 20);
                return w > 0 && h > 0 && w < int.MaxValue && h < int.MaxValue ? ((int)w, (int)h) : null;
            }
            case "gif":
            {
                var b = file.ReadRange(0, 10);
                if (b.Length < 10) return null;
                int w = U16(b, 6), h = U16(b, 8);
                return w > 0 && h > 0 ? (w, h) : null;
            }
            case "bmp":
            {
                var b = file.ReadRange(0, 26);
                if (b.Length < 22) return null;
                uint hdr = U32(b, 14);
                if (hdr == 12) { int w = U16(b, 18), h = U16(b, 20); return w > 0 && h > 0 ? (w, h) : null; }
                if (b.Length < 26) return null;
                long wl = (int)U32(b, 18), hl = Math.Abs((long)(int)U32(b, 22));
                return wl > 0 && hl > 0 && wl < int.MaxValue && hl < int.MaxValue ? ((int)wl, (int)hl) : null;
            }
            case "webp": return WebpSize(file);
            case "jpeg": return JpegSize(file);
            default: return null;
        }
    }

    private static uint U32Be(byte[] b, int o) => (uint)((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);

    private static (int, int)? WebpSize(UploadedFile file)
    {
        var b = file.ReadRange(0, 32);
        if (b.Length < 30) return null;
        if (FileSignatures.Ascii(b, 12, "VP8 "))
        {
            if (b[23] != 0x9d || b[24] != 0x01 || b[25] != 0x2a) return null;
            int w = (b[26] | (b[27] << 8)) & 0x3fff, h = (b[28] | (b[29] << 8)) & 0x3fff;
            return w > 0 && h > 0 ? (w, h) : null;
        }
        if (FileSignatures.Ascii(b, 12, "VP8L"))
        {
            if (b[20] != 0x2f || b.Length < 25) return null;
            int w = 1 + (b[21] | ((b[22] & 0x3f) << 8));
            int h = 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0xf) << 10));
            return (w, h);
        }
        if (FileSignatures.Ascii(b, 12, "VP8X"))
        {
            int w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
            int h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
            return (w, h);
        }
        return null;
    }

    private static (int, int)? JpegSize(UploadedFile file)
    {
        long pos = 2, length = file.Length;
        while (pos + 4 <= length)
        {
            var m = file.ReadRange(pos, pos + 4);
            if (m.Length < 4) return null;
            if (m[0] != 0xff) return null;
            int marker = m[1];
            if (marker == 0xff) { pos += 1; continue; }                                    // fill byte
            if (marker == 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { pos += 2; continue; }   // standalone markers
            if (marker == 0xd9 || marker == 0xda) return null;                              // end of image / start of scan without a frame header
            int len = (m[2] << 8) | m[3];
            if (len < 2) return null;
            bool sof = marker >= 0xc0 && marker <= 0xcf && marker != 0xc4 && marker != 0xc8 && marker != 0xcc;
            if (sof)
            {
                var f = file.ReadRange(pos + 4, pos + 9);
                if (f.Length < 5) return null;
                int h = (f[1] << 8) | f[2], w = (f[3] << 8) | f[4];
                return w > 0 && h > 0 ? (w, h) : null;
            }
            pos += 2 + len;
        }
        return null;
    }
}

/// <summary>JavaScript number behaviour the messages depend on.</summary>
internal static class Js
{
    /// <summary>Math.round: halves round up.</summary>
    internal static string Round(double v) => Math.Floor(v + 0.5).ToString("0", System.Globalization.CultureInfo.InvariantCulture);
}
