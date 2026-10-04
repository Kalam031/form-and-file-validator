namespace FormAndFileValidator;

/// <summary>What a JPEG, PNG or WebP gives away: camera data, GPS position, XMP, IPTC, comments.</summary>
public sealed class PhotoMetadata
{
    /// <summary>"jpeg", "png" or "webp".</summary>
    public string Format { get; }
    public bool Exif { get; }

    /// <summary>True only when a latitude or longitude is really stored.</summary>
    public bool Gps { get; }
    public bool Xmp { get; }
    public bool Iptc { get; }
    public bool Comments { get; }

    /// <summary>EXIF orientation 1-8, or null.</summary>
    public int? Orientation { get; }

    /// <summary>Readable names of what was found: EXIF, GPS location, XMP, IPTC / Photoshop, comments, other.</summary>
    public IReadOnlyList<string> Kinds { get; }

    internal PhotoMetadata(string format, PhotoPrivacy.Meta m)
    {
        Format = format; Exif = m.Exif; Gps = m.Gps; Xmp = m.Xmp; Iptc = m.Iptc; Comments = m.Comments; Orientation = m.Orientation;
        Kinds = m.Kinds();
    }
}

/// <summary>Options of <see cref="PhotoPrivacy"/>.</summary>
public sealed class MetadataOptions
{
    /// <summary>Keep the EXIF Orientation tag (as a minimal EXIF block) so phone photos stay upright. Default true.</summary>
    public bool KeepOrientation { get; set; } = true;

    /// <summary>Keep the embedded colour profile. Default true.</summary>
    public bool KeepColorProfile { get; set; } = true;

    /// <summary>Largest file to read, in MB. Default 64.</summary>
    public int MaxMB { get; set; } = 64;
}

/// <summary>The result of <see cref="PhotoPrivacy.Strip(byte[], MetadataOptions)"/>.</summary>
public sealed class StripResult
{
    /// <summary>The cleaned bytes, or the original bytes when nothing was removed.</summary>
    public byte[] Data { get; }

    /// <summary>False when the file is not a readable JPEG, PNG or WebP, or had nothing to remove.</summary>
    public bool Changed { get; }

    /// <summary>What was removed, for example EXIF, GPS location.</summary>
    public IReadOnlyList<string> Removed { get; }

    internal StripResult(byte[] data, bool changed, IReadOnlyList<string> removed) { Data = data; Changed = changed; Removed = removed; }
}

/// <summary>
/// Reads and removes the metadata of photos (JPEG, PNG, WebP) on the server, byte for byte what the JavaScript <c>FileValidator.stripMetadata</c> does:
/// the picture is not re-encoded, so there is no quality loss. The EXIF orientation is kept, so phone photos stay upright.
/// Call it on an upload before you store it: <c>var clean = PhotoPrivacy.Strip(UploadedFile.From(file));</c>
/// </summary>
public static class PhotoPrivacy
{
    internal sealed class Meta
    {
        public bool Exif, Gps, Xmp, Iptc, Comments, Other;
        public int? Orientation;

        public List<string> Kinds()
        {
            var k = new List<string>();
            if (Exif) k.Add("EXIF");
            if (Gps) k.Add("GPS location");
            if (Xmp) k.Add("XMP");
            if (Iptc) k.Add("IPTC / Photoshop");
            if (Comments) k.Add("comments");
            if (Other) k.Add("other");
            return k;
        }
    }

    sealed class Scan
    {
        public string Format = "";
        public Meta Meta = new Meta();
        public List<byte[]> Parts = new List<byte[]>();
        public int Removed;
    }

    sealed class Tiff { public int? Orientation; public bool HasGps; }

    // JavaScript reads past the end of an array as undefined, which counts as 0 in bit operations.
    static int G(byte[] b, long i) => i >= 0 && i < b.Length ? b[i] : 0;
    static int Be16(byte[] b, int o) => (G(b, o) << 8) | G(b, o + 1);
    static uint Be32(byte[] b, int o) => (uint)((G(b, o) << 24) | (G(b, o + 1) << 16) | (G(b, o + 2) << 8) | G(b, o + 3));
    static byte[] PutBe32(uint n) => new[] { (byte)(n >> 24), (byte)(n >> 16), (byte)(n >> 8), (byte)n };
    static byte[] PutLe32(uint n) => new[] { (byte)n, (byte)(n >> 8), (byte)(n >> 16), (byte)(n >> 24) };
    static byte[] Ascii(string s) => s.Select(c => (byte)c).ToArray();
    static byte[] Slice(byte[] b, long from, long to)
    {
        long end = Math.Min(to, b.Length);
        var r = new byte[Math.Max(0, end - from)];
        Buffer.BlockCopy(b, (int)from, r, 0, r.Length);
        return r;
    }
    static byte[] Concat(IEnumerable<byte[]> parts)
    {
        var list = parts.ToList();
        var r = new byte[list.Sum(p => p.Length)];
        int at = 0;
        foreach (var p in list) { Buffer.BlockCopy(p, 0, r, at, p.Length); at += p.Length; }
        return r;
    }

    static readonly uint[] CrcTable = BuildCrcTable();
    static uint[] BuildCrcTable()
    {
        var t = new uint[256];
        for (uint n = 0; n < 256; n++) { uint c = n; for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? (0xedb88320u ^ (c >> 1)) : (c >> 1); t[n] = c; }
        return t;
    }
    static uint Crc32(byte[] b)
    {
        uint c = 0xffffffff;
        foreach (byte x in b) c = CrcTable[(c ^ x) & 255] ^ (c >> 8);
        return c ^ 0xffffffff;
    }

    // ------------------------------------------------------------------ EXIF
    static Tiff? ParseTiff(byte[] b, int o, int end)
    {
        if (end - o < 8) return null;
        bool little = G(b, o) == 0x49 && G(b, o + 1) == 0x49;
        if (!little && !(G(b, o) == 0x4d && G(b, o + 1) == 0x4d)) return null;
        int R16(long p) => little ? (G(b, p) | (G(b, p + 1) << 8)) : ((G(b, p) << 8) | G(b, p + 1));
        long R32(long p) => little ? (uint)(G(b, p) | (G(b, p + 1) << 8) | (G(b, p + 2) << 16) | (G(b, p + 3) << 24)) : (uint)((G(b, p) << 24) | (G(b, p + 1) << 16) | (G(b, p + 2) << 8) | G(b, p + 3));
        if (R16(o + 2) != 42) return null;
        long ifd = o + R32(o + 4);
        if (ifd + 2 > end) return null;
        var t = new Tiff();
        int n = R16(ifd);
        for (int i = 0; i < n; i++)
        {
            long e = ifd + 2 + i * 12L;
            if (e + 12 > end) break;
            int tag = R16(e);
            if (tag == 0x0112 && R16(e + 2) == 3) { int v = R16(e + 8); if (v >= 1 && v <= 8) t.Orientation = v; }
            else if (tag == 0x8825)
            {
                long gps = o + R32(e + 8);
                if (gps + 2 <= end)
                {
                    int gn = R16(gps);
                    for (int j = 0; j < gn; j++)
                    {
                        long ge = gps + 2 + j * 12L;
                        if (ge + 12 > end) break;
                        int gt = R16(ge);
                        if (gt == 2 || gt == 4) t.HasGps = true;   // GPSLatitude / GPSLongitude
                    }
                }
            }
        }
        return t;
    }

    /// <summary>A TIFF block with nothing but the Orientation tag (26 bytes).</summary>
    static byte[] OrientationTiff(int v) => new byte[] { 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, (byte)v, 0, 0, 0, 0, 0, 0, 0 };

    static void ReadExifInto(Meta m, Tiff? t)
    {
        m.Exif = true;
        if (t != null) { if (t.Orientation != null) m.Orientation = t.Orientation; if (t.HasGps) m.Gps = true; }
    }

    static bool KeepsOrientation(Meta m, bool keep) => keep && m.Orientation != null && m.Orientation > 1;

    // ------------------------------------------------------------------ JPEG
    static Scan? ScanJpeg(byte[] b, bool keepOrientation, bool keepColorProfile)
    {
        if (b.Length < 4 || b[0] != 0xff || b[1] != 0xd8) return null;
        var meta = new Meta();
        var kept = new List<(byte[] Bytes, bool App0)>();
        int removed = 0, pos = 2;
        byte[]? tail = null;
        while (pos + 2 <= b.Length)
        {
            if (b[pos] != 0xff) return null;
            int marker = b[pos + 1];
            if (marker == 0xff) { pos++; continue; }
            if (marker == 0xda || marker == 0xd9) { tail = Slice(b, pos, b.Length); break; }
            if (marker == 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { kept.Add((Slice(b, pos, pos + 2), false)); pos += 2; continue; }
            if (pos + 4 > b.Length) return null;
            int len = Be16(b, pos + 2);
            if (len < 2 || pos + 2 + len > b.Length) return null;
            int at = pos + 4, end = pos + 2 + len;
            bool drop = false;
            if (marker == 0xe1)
            {
                drop = true;
                if (FileSignatures.Ascii(b, at, "Exif\0\0")) ReadExifInto(meta, ParseTiff(b, at + 6, end));
                else if (FileSignatures.Ascii(b, at, "http://ns.adobe.com/")) meta.Xmp = true;
                else meta.Other = true;
            }
            else if (marker == 0xe2)
            {
                bool icc = FileSignatures.Ascii(b, at, "ICC_PROFILE\0");
                if (!icc || !keepColorProfile) { drop = true; if (!icc) meta.Other = true; }
            }
            else if (marker == 0xed) { drop = true; meta.Iptc = true; }
            else if (marker == 0xfe) { drop = true; meta.Comments = true; }
            else if ((marker >= 0xe3 && marker <= 0xec) || marker == 0xef) { drop = true; meta.Other = true; }
            if (drop) removed++; else kept.Add((Slice(b, pos, end), marker == 0xe0));
            pos = end;
        }
        if (tail == null) return null;
        var parts = new List<byte[]> { Slice(b, 0, 2) };
        bool inserted = false;
        byte[]? exifSeg = KeepsOrientation(meta, keepOrientation)
            ? Concat(new[] { new byte[] { 0xff, 0xe1, 0, 34 }, Ascii("Exif\0\0"), OrientationTiff(meta.Orientation!.Value) }) : null;
        foreach (var k in kept)
        {
            if (exifSeg != null && !inserted && !k.App0) { parts.Add(exifSeg); inserted = true; }
            parts.Add(k.Bytes);
        }
        if (exifSeg != null && !inserted) parts.Add(exifSeg);
        parts.Add(tail);
        return new Scan { Format = "jpeg", Meta = meta, Parts = parts, Removed = removed };
    }

    // ------------------------------------------------------------------ PNG
    static Scan? ScanPng(byte[] b, bool keepOrientation)
    {
        if (b.Length < 33 || !FileSignatures.Bytes(b, new[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a })) return null;
        var meta = new Meta();
        var kept = new List<(string Type, byte[] Bytes)>();
        int removed = 0, pos = 8;
        bool sawEnd = false;
        while (pos + 12 <= b.Length)
        {
            long size = Be32(b, pos);
            if (pos + 12 + size > b.Length) return null;
            string type = new string(new[] { (char)b[pos + 4], (char)b[pos + 5], (char)b[pos + 6], (char)b[pos + 7] });
            bool drop = false;
            if (type == "eXIf") { drop = true; ReadExifInto(meta, ParseTiff(b, pos + 8, (int)(pos + 8 + size))); }
            else if (type == "iTXt") { drop = true; if (FileSignatures.Ascii(b, pos + 8, "XML:com.adobe.xmp")) meta.Xmp = true; else meta.Comments = true; }
            else if (type == "tEXt" || type == "zTXt") { drop = true; meta.Comments = true; }
            else if (type == "tIME") { drop = true; meta.Other = true; }
            if (drop) removed++; else kept.Add((type, Slice(b, pos, pos + 12 + size)));
            pos += (int)(12 + size);
            if (type == "IEND") { sawEnd = true; break; }
        }
        if (!sawEnd) return null;
        var parts = new List<byte[]> { Slice(b, 0, 8) };
        bool inserted = false;
        byte[]? exifChunk = null;
        if (KeepsOrientation(meta, keepOrientation))
        {
            var body = Concat(new[] { Ascii("eXIf"), OrientationTiff(meta.Orientation!.Value) });
            exifChunk = Concat(new[] { PutBe32(26), body, PutBe32(Crc32(body)) });
        }
        foreach (var k in kept)
        {
            if (exifChunk != null && !inserted && k.Type == "IDAT") { parts.Add(exifChunk); inserted = true; }
            parts.Add(k.Bytes);
        }
        return new Scan { Format = "png", Meta = meta, Parts = parts, Removed = removed };
    }

    // ------------------------------------------------------------------ WebP
    static Scan? ScanWebp(byte[] b, bool keepOrientation)
    {
        if (b.Length < 16 || !FileSignatures.Ascii(b, 0, "RIFF") || !FileSignatures.Ascii(b, 8, "WEBP")) return null;
        var meta = new Meta();
        var kept = new List<(string Id, byte[] Bytes)>();
        int removed = 0, pos = 12;
        bool hasVp8x = false;
        while (pos + 8 <= b.Length)
        {
            string id = new string(new[] { (char)b[pos], (char)b[pos + 1], (char)b[pos + 2], (char)b[pos + 3] });
            long size = FileSignatures.U32(b, pos + 4), padded = size + (size & 1);
            if (pos + 8 + size > b.Length) return null;
            bool drop = false;
            if (id == "EXIF")
            {
                drop = true;
                int off = FileSignatures.Ascii(b, pos + 8, "Exif\0\0") ? 6 : 0;
                ReadExifInto(meta, ParseTiff(b, pos + 8 + off, (int)(pos + 8 + size)));
            }
            else if (id == "XMP ") { drop = true; meta.Xmp = true; }
            if (id == "VP8X") hasVp8x = true;
            if (drop) removed++; else kept.Add((id, Slice(b, pos, Math.Min(b.Length, pos + 8 + padded))));
            pos += (int)(8 + padded);
        }
        bool exif = KeepsOrientation(meta, keepOrientation) && hasVp8x;
        var parts = new List<byte[]>();
        foreach (var k in kept)
        {
            if (k.Id == "VP8X")
            {
                int flags = k.Bytes[8];
                k.Bytes[8] = (byte)((flags & ~0x0c) | (exif ? 0x08 : 0));   // clear the EXIF (0x08) and XMP (0x04) flags
                parts.Add(k.Bytes);
                if (exif) parts.Add(Concat(new[] { Ascii("EXIF"), PutLe32(26), OrientationTiff(meta.Orientation!.Value) }));
            }
            else parts.Add(k.Bytes);
        }
        var body2 = Concat(parts);
        var outBytes = Concat(new[] { Ascii("RIFF"), PutLe32((uint)(body2.Length + 4)), Ascii("WEBP"), body2 });
        return new Scan { Format = "webp", Meta = meta, Parts = new List<byte[]> { outBytes }, Removed = removed };
    }

    static Scan? ScanImage(byte[] b, MetadataOptions? o)
    {
        bool ori = o?.KeepOrientation ?? true, icc = o?.KeepColorProfile ?? true;
        return ScanJpeg(b, ori, icc) ?? ScanPng(b, ori) ?? ScanWebp(b, ori);
    }

    static bool TooBig(byte[] data, MetadataOptions? o) => data.Length == 0 || data.Length > (long)(o?.MaxMB ?? 64) * 1048576;

    // ------------------------------------------------------------------ public API
    /// <summary>What is hidden in a photo, or null for a file that is not a readable JPEG, PNG or WebP.</summary>
    public static PhotoMetadata? Read(byte[] data, MetadataOptions? options = null)
    {
        if (data == null || TooBig(data, options)) return null;
        var scan = ScanImage(data, options);
        return scan == null ? null : new PhotoMetadata(scan.Format, scan.Meta);
    }

    /// <summary><see cref="Read(byte[], MetadataOptions)"/> for an uploaded file.</summary>
    public static PhotoMetadata? Read(UploadedFile file, MetadataOptions? options = null)
        => file.Length > (long)(options?.MaxMB ?? 64) * 1048576 ? null : Read(ReadAll(file), options);

    /// <summary>
    /// Removes EXIF (camera, date, GPS position), XMP, IPTC / Photoshop data and comments from a JPEG, PNG or WebP without re-encoding the picture.
    /// Files that are not readable photos, and photos with nothing to remove, come back unchanged (<see cref="StripResult.Changed"/> is false).
    /// </summary>
    public static StripResult Strip(byte[] data, MetadataOptions? options = null)
    {
        if (data == null || TooBig(data, options)) return new StripResult(data ?? new byte[0], false, new string[0]);
        var scan = ScanImage(data, options);
        if (scan == null || scan.Removed == 0) return new StripResult(data, false, new string[0]);
        return new StripResult(Concat(scan.Parts), true, scan.Meta.Kinds());
    }

    /// <summary>The same for an uploaded file: returns a new <see cref="UploadedFile"/> (same name, type and folder path), or the same instance when nothing changed.</summary>
    public static UploadedFile Strip(UploadedFile file, MetadataOptions? options = null)
    {
        if (file.Length > (long)(options?.MaxMB ?? 64) * 1048576 || file.Length == 0) return file;
        var result = Strip(ReadAll(file), options);
        return result.Changed ? new UploadedFile(file.Name, file.ContentType, result.Data.Length, () => new MemoryStream(result.Data, false)) { Path = file.Path } : file;
    }

    static byte[] ReadAll(UploadedFile file) => file.ReadRange(0, file.Length);
}
