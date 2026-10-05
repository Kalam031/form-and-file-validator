// Malware scanner adapters for the FileValidator `scan` option: `import { clamav, virustotal, httpScanner, all } from 'form-and-file-validator/scanners'` (Node 18+)
export type ScanResult = true | { valid: false; threat: string; [key: string]: unknown };
export type Scanner = (file: File | Blob | Buffer, ctx?: unknown) => Promise<ScanResult>;

/** ClamAV daemon (clamd) over TCP or a unix socket, INSTREAM. */
export declare function clamav(options?: { host?: string; port?: number; socket?: string; timeout?: number; chunkSize?: number }): Scanner;
/** VirusTotal v3: hash lookup, optional upload. */
export declare function virustotal(options: { apiKey: string; minDetections?: number; countSuspicious?: boolean; upload?: boolean; unknown?: 'allow' | 'block'; pollMs?: number; maxWaitMs?: number; baseUrl?: string; fetch?: typeof fetch }): Scanner;
/** Your own HTTP scanning service. */
export declare function httpScanner(options: { url: string; method?: string; headers?: Record<string, string>; field?: string; timeout?: number; fetch?: typeof fetch; parse?: (json: any, response: Response) => boolean | string | ScanResult | Promise<boolean | string | ScanResult> }): Scanner;
/** Runs scanners in order; the first threat wins. */
export declare function all(...scanners: Array<Scanner | null | undefined>): Scanner;
