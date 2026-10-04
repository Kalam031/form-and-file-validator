namespace FormAndFileValidator;

/// <summary>A file format recognised by its first bytes (the same table as the JavaScript FileValidator, in the same order).</summary>
internal sealed class FileSignature
{
    public string Name { get; }
    public string? Mime { get; }
    public string[] Exts { get; }
    public bool Executable { get; }
    public bool Weak { get; }
    public Func<byte[], bool> Test { get; }

    public FileSignature(string name, string? mime, string[] exts, Func<byte[], bool> test, bool executable = false, bool weak = false)
    {
        Name = name; Mime = mime; Exts = exts; Test = test; Executable = executable; Weak = weak;
    }
}

internal static class FileSignatures
{
    // JavaScript reads past the end of an array as undefined: it never equals a number, but counts as 0 in bit operations.
    private static int At(byte[] b, int i) => i < b.Length ? b[i] : -1;
    private static int Bits(byte[] b, int i) => i < b.Length ? b[i] : 0;

    internal static bool Ascii(byte[] b, int off, string s)
    {
        if (off + s.Length > b.Length) return false;
        for (int i = 0; i < s.Length; i++) if (b[off + i] != s[i]) return false;
        return true;
    }

    internal static bool Bytes(byte[] b, int[] arr, int off = 0)
    {
        if (off + arr.Length > b.Length) return false;
        for (int i = 0; i < arr.Length; i++) if (b[off + i] != arr[i]) return false;
        return true;
    }

    internal static uint U32(byte[] b, int o) => (uint)(Bits(b, o) | (Bits(b, o + 1) << 8) | (Bits(b, o + 2) << 16) | (Bits(b, o + 3) << 24));

    private static readonly string[] ImageBrands = { "heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis" };

    private static string[] E(string list) => list.Length == 0 ? new string[0] : list.Split(' ');

    internal static readonly FileSignature[] All =
    {
        new FileSignature("png", "image/png", E(".png .apng"), b => Bytes(b, new[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a })),
        new FileSignature("jpeg", "image/jpeg", E(".jpg .jpeg .jpe .jfif"), b => Bytes(b, new[] { 0xff, 0xd8, 0xff })),
        new FileSignature("gif", "image/gif", E(".gif"), b => Ascii(b, 0, "GIF8")),
        new FileSignature("webp", "image/webp", E(".webp"), b => Ascii(b, 0, "RIFF") && Ascii(b, 8, "WEBP")),
        new FileSignature("bmp", "image/bmp", E(".bmp"), b => Ascii(b, 0, "BM") && b.Length >= 18 && U32(b, 6) == 0 &&
            new uint[] { 12, 40, 52, 56, 64, 108, 124 }.Contains(U32(b, 14))),
        new FileSignature("ico", "image/x-icon", E(".ico .cur"), b => (Bytes(b, new[] { 0, 0, 1, 0 }) || Bytes(b, new[] { 0, 0, 2, 0 })) && At(b, 4) > 0 && At(b, 5) == 0),
        new FileSignature("tiff", "image/tiff", E(".tif .tiff"), b => Bytes(b, new[] { 0x49, 0x49, 0x2a, 0 }) || Bytes(b, new[] { 0x4d, 0x4d, 0, 0x2a })),
        new FileSignature("heif", "image/heif", E(".heic .heif .avif"), b => Ascii(b, 4, "ftyp") && ImageBrands.Any(x => Ascii(b, 8, x))),
        new FileSignature("iso-bmff", "video/mp4", E(".mp4 .m4v .m4a .m4b .mov .3gp .3g2 .f4v"), b => Ascii(b, 4, "ftyp") || Ascii(b, 4, "moov")),
        new FileSignature("matroska", "video/webm", E(".webm .mkv .weba"), b => Bytes(b, new[] { 0x1a, 0x45, 0xdf, 0xa3 })),
        new FileSignature("avi", "video/x-msvideo", E(".avi"), b => Ascii(b, 0, "RIFF") && Ascii(b, 8, "AVI ")),
        new FileSignature("wav", "audio/wav", E(".wav"), b => Ascii(b, 0, "RIFF") && Ascii(b, 8, "WAVE")),
        new FileSignature("ogg", "audio/ogg", E(".ogg .oga .ogv .opus"), b => Ascii(b, 0, "OggS")),
        new FileSignature("flac", "audio/flac", E(".flac"), b => Ascii(b, 0, "fLaC")),
        new FileSignature("mp3", "audio/mpeg", E(".mp3"), b =>
            (Ascii(b, 0, "ID3") && At(b, 3) >= 2 && At(b, 3) <= 4 && At(b, 4) == 0 && (Bits(b, 6) | Bits(b, 7) | Bits(b, 8) | Bits(b, 9)) < 0x80) ||
            (At(b, 0) == 0xff && (Bits(b, 1) & 0xe6) == 0xe2 && (Bits(b, 1) & 0x18) != 0x08)),
        new FileSignature("aac", "audio/aac", E(".aac"), b => At(b, 0) == 0xff && (Bits(b, 1) & 0xf6) == 0xf0),
        new FileSignature("pdf", "application/pdf", E(".pdf"), b => Ascii(b, 0, "%PDF")),
        new FileSignature("zip", "application/zip", E(".zip .docx .xlsx .pptx .docm .xlsm .pptm .odt .ods .odp .epub .vsix .xpi .whl .jar .war .apk"),
            b => Ascii(b, 0, "PK") && (At(b, 2) == 3 || At(b, 2) == 5) && (At(b, 3) == 4 || At(b, 3) == 6)),
        new FileSignature("rar", "application/vnd.rar", E(".rar"), b => Ascii(b, 0, "Rar!")),
        new FileSignature("7z", "application/x-7z-compressed", E(".7z"), b => Bytes(b, new[] { 0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c })),
        new FileSignature("gzip", "application/gzip", E(".gz .tgz"), b => Bytes(b, new[] { 0x1f, 0x8b })),
        new FileSignature("ole", "application/msword", E(".doc .xls .ppt .msg"), b => Bytes(b, new[] { 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1 })),
        new FileSignature("psd", "image/vnd.adobe.photoshop", E(".psd"), b => Ascii(b, 0, "8BPS")),
        new FileSignature("jp2", "image/jp2", E(".jp2 .j2k"), b => Bytes(b, new[] { 0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a })),
        new FileSignature("dwg", "image/vnd.dwg", E(".dwg"), b => Ascii(b, 0, "AC10")),
        new FileSignature("rtf", "application/rtf", E(".rtf"), b => Ascii(b, 0, "{" + (char)92 + "rtf")),
        new FileSignature("postscript", "application/postscript", E(".ps .eps"), b => Ascii(b, 0, "%!PS") || Bytes(b, new[] { 0xc5, 0xd0, 0xd3, 0xc6 })),
        new FileSignature("sqlite", "application/vnd.sqlite3", E(".sqlite .sqlite3 .db3"), b => Ascii(b, 0, "SQLite format 3") && At(b, 15) == 0),
        new FileSignature("woff", "font/woff", E(".woff"), b => Ascii(b, 0, "wOFF")),
        new FileSignature("woff2", "font/woff2", E(".woff2"), b => Ascii(b, 0, "wOF2")),
        new FileSignature("otf", "font/otf", E(".otf"), b => Ascii(b, 0, "OTTO")),
        new FileSignature("ttf", "font/ttf", E(".ttf"), b => Bytes(b, new[] { 0, 1, 0, 0 }) && At(b, 4) == 0 && At(b, 5) > 0 && At(b, 5) < 64, weak: true),
        new FileSignature("xz", "application/x-xz", E(".xz"), b => Bytes(b, new[] { 0xfd, 0x37, 0x7a, 0x58, 0x5a, 0 })),
        new FileSignature("zstd", "application/zstd", E(".zst"), b => Bytes(b, new[] { 0x28, 0xb5, 0x2f, 0xfd })),
        new FileSignature("bzip2", "application/x-bzip2", E(".bz2"), b => Ascii(b, 0, "BZh") && At(b, 3) >= 0x31 && At(b, 3) <= 0x39),
        new FileSignature("cab", "application/vnd.ms-cab-compressed", E(".cab"), b => Ascii(b, 0, "MSCF")),
        new FileSignature("tar", "application/x-tar", E(".tar"), b => Ascii(b, 257, "ustar")),
        new FileSignature("flv", "video/x-flv", E(".flv"), b => Ascii(b, 0, "FLV") && At(b, 3) == 1),
        new FileSignature("asf", "video/x-ms-asf", E(".wmv .wma .asf"), b => Bytes(b, new[] { 0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11 })),
        new FileSignature("midi", "audio/midi", E(".mid .midi"), b => Ascii(b, 0, "MThd")),
        new FileSignature("aiff", "audio/aiff", E(".aif .aiff .aifc"), b => Ascii(b, 0, "FORM") && (Ascii(b, 8, "AIFF") || Ascii(b, 8, "AIFC"))),
        new FileSignature("mpeg-ps", "video/mpeg", E(".mpg .mpeg .vob"), b => Bytes(b, new[] { 0, 0, 1, 0xba })),
        // programs: reported as DANGEROUS_CONTENT
        new FileSignature("exe", null, E(".exe .dll .sys .scr .com"), b => Ascii(b, 0, "MZ") && b.Length >= 64 && U32(b, 60) >= 0x40 && U32(b, 60) < 0x100000, executable: true),
        new FileSignature("elf", null, E(""), b => Bytes(b, new[] { 0x7f, 0x45, 0x4c, 0x46 }), executable: true),
        new FileSignature("mach-o", null, E(""), b => Bytes(b, new[] { 0xcf, 0xfa, 0xed, 0xfe }) || Bytes(b, new[] { 0xfe, 0xed, 0xfa, 0xcf }) ||
            Bytes(b, new[] { 0xce, 0xfa, 0xed, 0xfe }) || Bytes(b, new[] { 0xfe, 0xed, 0xfa, 0xce }) || Bytes(b, new[] { 0xca, 0xfe, 0xba, 0xbe }), executable: true),
        new FileSignature("wasm", null, E(".wasm"), b => Bytes(b, new[] { 0, 0x61, 0x73, 0x6d, 1, 0, 0, 0 }), executable: true),
        new FileSignature("lnk", null, E(".lnk"), b => Bytes(b, new[] { 0x4c, 0, 0, 0, 1, 0x14, 2, 0 }), executable: true),
        new FileSignature("chm", null, E(".chm"), b => Ascii(b, 0, "ITSF"), executable: true),
        new FileSignature("dex", null, E(""), b => Ascii(b, 0, "dex" + (char)10), executable: true),
        new FileSignature("shebang", null, E(".sh"), b => Ascii(b, 0, "#!/") || Ascii(b, 0, "#! /"), executable: true),
    };

    /// <summary>Every extension that some non-program signature claims.</summary>
    internal static readonly HashSet<string> SignatureExts = new HashSet<string>(All.Where(s => !s.Executable).SelectMany(s => s.Exts));

    /// <summary>The matching signature, or null when the bytes match nothing.</summary>
    internal static FileSignature? Detect(byte[] head) => All.FirstOrDefault(s => s.Test(head));
}
