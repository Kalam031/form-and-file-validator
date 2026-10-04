using System.Collections;
using System.Reflection;

namespace FormAndFileValidator;

/// <summary>
/// One uploaded file, whatever framework received it. Wrap an ASP.NET Core <c>IFormFile</c> or an MVC 5 <c>HttpPostedFileBase</c>
/// with <see cref="From(object)"/>, or build one from bytes or a stream.
/// </summary>
public sealed class UploadedFile
{
    private readonly Func<Stream> _open;

    /// <summary>The file name as the client sent it (never trusted: the validator checks it).</summary>
    public string Name { get; }

    /// <summary>The MIME type the client reported, or an empty string.</summary>
    public string ContentType { get; }

    /// <summary>The size in bytes.</summary>
    public long Length { get; }

    /// <summary>Relative folder path for a file picked from a folder ("photos/2024/a.jpg"), or an empty string.</summary>
    public string Path { get; init; } = "";

    public UploadedFile(string? name, string? contentType, long length, Func<Stream> open)
    {
        Name = name ?? "";
        ContentType = (contentType ?? "").Trim();
        Length = length;
        _open = open ?? throw new ArgumentNullException(nameof(open));
    }

    /// <summary>A file held in memory (tests, generated files).</summary>
    public static UploadedFile FromBytes(string name, string? contentType, byte[] data)
        => new UploadedFile(name, contentType, data.Length, () => new MemoryStream(data, false));

    /// <summary>A seekable stream (each check opens its own read pass: the stream is rewound, not disposed).</summary>
    public static UploadedFile FromStream(string name, string? contentType, Stream stream)
        => new UploadedFile(name, contentType, stream.Length, () => { stream.Position = 0; return new NonClosingStream(stream); });

    /// <summary>A file on disk.</summary>
    public static UploadedFile FromPath(string path, string? contentType = null)
    {
        var info = new FileInfo(path);
        return new UploadedFile(info.Name, contentType, info.Length, () => new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read));
    }

    /// <summary>
    /// Wraps the file object of the framework without referencing it: ASP.NET Core <c>IFormFile</c> (FileName, ContentType, Length, OpenReadStream)
    /// and ASP.NET MVC 5 / Web Forms <c>HttpPostedFileBase</c> (FileName, ContentType, ContentLength, InputStream). Returns an
    /// <see cref="UploadedFile"/> unchanged.
    /// </summary>
    public static UploadedFile From(object file)
    {
        if (file is UploadedFile same) return same;
        if (file == null) throw new ArgumentNullException(nameof(file));
        var t = file.GetType();
        string? name = Get<string>(t, file, "FileName") ?? Get<string>(t, file, "Name");
        string? type = Get<string>(t, file, "ContentType");
        long length;
        object? len = GetObject(t, file, "Length") ?? GetObject(t, file, "ContentLength");
        if (len == null) throw new ArgumentException("Not an uploaded file (no Length / ContentLength): " + t.FullName, nameof(file));
        length = Convert.ToInt64(len, System.Globalization.CultureInfo.InvariantCulture);

        MethodInfo? openRead = t.GetMethod("OpenReadStream", Type.EmptyTypes);
        PropertyInfo? input = t.GetProperty("InputStream");
        if (openRead == null && input == null) throw new ArgumentException("Not an uploaded file (no OpenReadStream / InputStream): " + t.FullName, nameof(file));
        Func<Stream> open = openRead != null
            ? () => (Stream)openRead.Invoke(file, null)!
            : () => { var s = (Stream)input!.GetValue(file)!; if (s.CanSeek) s.Position = 0; return new NonClosingStream(s); };
        return new UploadedFile(name, type, length, open);
    }

    /// <summary>One file or a list of files (<c>IFormFileCollection</c>, <c>IEnumerable&lt;HttpPostedFileBase&gt;</c>, an array). Null items are skipped.</summary>
    public static IList<UploadedFile> FromMany(object? files)
    {
        var list = new List<UploadedFile>();
        if (files == null) return list;
        if (files is string) return list;
        if (files is IEnumerable many) { foreach (var f in many) if (f != null) list.Add(From(f)); }
        else list.Add(From(files));
        return list;
    }

    /// <summary>Opens a new read pass over the content. The caller disposes it.</summary>
    public Stream Open() => _open();

    internal byte[] ReadRange(long from, long to)
    {
        if (from < 0) from = 0;
        if (to > Length) to = Length;
        if (to <= from) return new byte[0];
        using var s = Open();
        if (s.CanSeek) s.Position = from;
        else SkipForward(s, from);
        var buffer = new byte[to - from];
        int read = 0;
        while (read < buffer.Length)
        {
            int n = s.Read(buffer, read, buffer.Length - read);
            if (n <= 0) break;
            read += n;
        }
        if (read == buffer.Length) return buffer;
        var cut = new byte[read];
        Buffer.BlockCopy(buffer, 0, cut, 0, read);
        return cut;
    }

    private static void SkipForward(Stream s, long count)
    {
        var scratch = new byte[8192];
        while (count > 0)
        {
            int n = s.Read(scratch, 0, (int)Math.Min(scratch.Length, count));
            if (n <= 0) break;
            count -= n;
        }
    }

    private static object? GetObject(Type t, object o, string name) => t.GetProperty(name)?.GetValue(o);
    private static T? Get<T>(Type t, object o, string name) where T : class => GetObject(t, o, name) as T;

    /// <summary>Keeps a framework stream open: the validator reads a file several times.</summary>
    private sealed class NonClosingStream : Stream
    {
        private readonly Stream _inner;
        public NonClosingStream(Stream inner) { _inner = inner; }
        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => _inner.CanSeek;
        public override bool CanWrite => false;
        public override long Length => _inner.Length;
        public override long Position { get => _inner.Position; set => _inner.Position = value; }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { /* the owner of the stream closes it */ }
    }
}
