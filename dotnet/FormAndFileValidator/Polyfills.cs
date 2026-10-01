// Lets the C# 9+ syntax used in this library (records, init accessors) compile for .NET Framework 4.6.1+ and .NET Standard 2.0.
#if !NET5_0_OR_GREATER
namespace System.Runtime.CompilerServices
{
    internal static class IsExternalInit { }
}
#endif
