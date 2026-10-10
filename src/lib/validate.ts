/** Filename / extension / range validation helpers (pure, isomorphic). */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const UNSAFE_NAME = /[\\/]/g;

/**
 * Make an uploaded or produced filename safe: no directories, no traversal,
 * no control characters, bounded length, never empty.
 */
export function sanitizeFilename(name: string, fallback = "file"): string {
  let out = String(name ?? "")
    .replace(UNSAFE_NAME, "_")
    .replace(CONTROL_CHARS, "")
    .replace(/^\.+/, "")
    .trim();
  // Guard against windows-style device names and pure traversal.
  out = out.replace(/\.{2,}/g, ".");
  if (!out || out === "." || out === "..") out = fallback;
  if (out.length > 180) {
    const dot = out.lastIndexOf(".");
    const ext = dot > 0 && out.length - dot <= 12 ? out.slice(dot) : "";
    out = out.slice(0, 180 - ext.length) + ext;
  }
  return out;
}

/** Lowercase extension without the dot ("" when none). */
export function extensionOf(name: string): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function stripExtension(name: string): string {
  const safe = sanitizeFilename(name);
  const dot = safe.lastIndexOf(".");
  return dot > 0 ? safe.slice(0, dot) : safe;
}

export function isExtensionAllowed(name: string, allowed: string[]): boolean {
  if (allowed.includes("*")) return true;
  return allowed.includes(extensionOf(name));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[i]}`;
}

export type RangeSpec = { start: number; end: number };

/**
 * Parse page-range specs like "1-3, 7, 10-".
 * Throws Error with a human-readable message on invalid input.
 */
export function parsePageRanges(spec: string, pageCount: number): RangeSpec[] {
  const trimmed = spec.trim();
  if (!trimmed) {
    return pageCount > 0 ? [{ start: 1, end: pageCount }] : [];
  }
  if (pageCount <= 0) throw new Error("This PDF has no pages.");
  const out: RangeSpec[] = [];
  for (const partRaw of trimmed.split(",")) {
    const part = partRaw.trim();
    if (!part) continue;
    const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part);
    let start: number;
    let end: number;
    if (m && (m[1] || m[2])) {
      start = m[1] ? Number(m[1]) : 1;
      end = m[2] ? Number(m[2]) : pageCount;
    } else if (/^\d+$/.test(part)) {
      start = Number(part);
      end = start;
    } else {
      throw new Error(`Invalid page range "${part}". Use formats like 1-3 or 7.`);
    }
    if (start < 1 || end < 1) throw new Error(`Invalid page range "${part}". Pages start at 1.`);
    if (start > end) throw new Error(`Invalid page range "${part}". Start must not exceed end.`);
    if (start > pageCount) throw new Error(`Page ${start} is out of range (document has ${pageCount} page${pageCount === 1 ? "" : "s"}).`);
    out.push({ start, end: Math.min(end, pageCount) });
  }
  if (out.length === 0) throw new Error("No page ranges provided.");
  if (out.length > 50) throw new Error("Too many ranges (maximum 50).");
  return out;
}

/**
 * Sanitize an archive entry path for safe extraction.
 * Returns a safe relative path (no traversal, no absolute paths, no drives),
 * or null when the entry must be skipped.
 */
export function sanitizeEntryPath(raw: string): string | null {
  const unified = String(raw ?? "").replace(/\\/g, "/").replace(/\u0000/g, "").trim();
  if (!unified) return null;
  const parts = unified
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..");
  if (parts.length === 0 || parts.length > 12) return null;
  const cleaned = parts
    .map((p) => p.replace(/^[a-zA-Z]:/, ""))
    .map((p) => p.replace(/[<>:"|?*]/g, "_"))
    .filter(Boolean);
  if (cleaned.length === 0) return null;
  const joined = cleaned.join("/");
  if (!joined || joined.length > 180) return null;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(cleaned[cleaned.length - 1] ?? "")) return null;
  return joined;
}
