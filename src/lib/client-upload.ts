/**
 * Browser-side conversion transport.
 * Uses XMLHttpRequest so upload progress is *real* (never fabricated) and the
 * request can be aborted. Server replies with JSON containing base64 outputs.
 */

export interface ApiOutput {
  name: string;
  mime: string;
  size: number;
  /** base64 payload */
  data: string;
}

export class ConvertClientError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConvertClientError";
    this.code = code;
  }
}

export class AbortedError extends Error {
  constructor() {
    super("The conversion was canceled.");
    this.name = "AbortedError";
  }
}

/** Sub-path aware endpoint (GitHub Pages serves under e.g. /File_type_converter). */
const API_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/convert`;

export interface UploadOptions {
  toolId: string;
  files: File[];
  options: Record<string, string | number>;
  /** 0–100 while bytes are being sent; null after the upload finished. */
  onSendProgress?: (percent: number | null) => void;
  signal?: AbortSignal;
}

export function uploadConversion({
  toolId,
  files,
  options,
  onSendProgress,
  signal,
}: UploadOptions): Promise<ApiOutput[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("tool", toolId);
    form.set("options", JSON.stringify(options));
    for (const file of files) form.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL);
    xhr.responseType = "text";

    let settled = false;
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const settleResolve = (out: ApiOutput[]) => {
      if (settled) return;
      settled = true;
      resolve(out);
    };

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onSendProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => {
      // All bytes sent — server is now processing (indeterminate by design).
      onSendProgress?.(null);
    };

    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText) as unknown;
      } catch {
        /* handled below */
      }
      const parsed = body as { outputs?: ApiOutput[]; error?: { code?: string; message?: string } } | null;
      if (xhr.status >= 200 && xhr.status < 300 && parsed?.outputs) {
        settleResolve(parsed.outputs);
      } else if (parsed?.error?.message) {
        settleReject(new ConvertClientError(parsed.error.code ?? "unknown", parsed.error.message));
      } else if (!parsed) {
        // Non-JSON reply (a static host's 404 page): the conversion server isn't part
        // of this deployment. Say so honestly instead of showing a raw status code.
        settleReject(
          new ConvertClientError(
            "unavailable",
            "This deployment is hosted without the conversion server, so files cannot be converted here. Run the app locally (npm ci && npm run dev) or deploy it to a Node host — see the README.",
          ),
        );
      } else {
        settleReject(new ConvertClientError("unknown", `The server responded ${xhr.status}. Please try again.`));
      }
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      settleReject(
        new ConvertClientError(
          "network",
          "Network error while uploading. Check your connection and try again.",
        ),
      );
    };
    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      settleReject(new AbortedError());
    };

    xhr.send(form);
  });
}

/** Decode a base64 payload into a Blob (chunk-free; sizes are bounded by server limits). */
export function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
