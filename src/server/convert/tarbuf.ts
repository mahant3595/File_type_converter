/**
 * Minimal in-memory TAR (USTAR + PAX/GNU long-name) reader/writer.
 * Pure Buffers: archives are never written to disk by this module.
 * Regular files only — links, devices and other special entries are skipped
 * on read to avoid unsafe extraction.
 */
import { ConvertError } from "./errors";

const BLOCK = 512;

export interface TarEntry {
  name: string;
  data: Buffer;
}

function writeOctal(buf: Buffer, value: number, offset: number, length: number): void {
  const oct = value.toString(8).padStart(length - 1, "0").slice(-(length - 1));
  buf.write(oct, offset, length - 1, "ascii");
  buf[offset + length - 1] = 0;
}

function splitName(name: string): { name: string; prefix: string } {
  const bytes = Buffer.byteLength(name, "utf8");
  if (bytes <= 100) return { name, prefix: "" };
  const idx = name.lastIndexOf("/");
  if (idx > 0) {
    const prefix = name.slice(0, idx);
    const tail = name.slice(idx + 1);
    if (Buffer.byteLength(prefix, "utf8") <= 155 && Buffer.byteLength(tail, "utf8") <= 100) {
      return { name: tail, prefix };
    }
  }
  throw new ConvertError("invalid_file", "A file name in this archive is too long.");
}

function makeHeader(entry: TarEntry, mtimeSec: number): Buffer {
  const header = Buffer.alloc(BLOCK);
  const split = splitName(entry.name);
  header.write(split.name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  writeOctal(header, entry.data.length, 124, 12);
  writeOctal(header, mtimeSec, 136, 12);
  header.write("        ", 148, 8, "ascii"); // checksum placeholder = spaces
  header.write("0", 156, 1, "ascii"); // regular file
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  if (split.prefix) header.write(split.prefix, 345, 155, "utf8");

  let sum = 0;
  for (const b of header) sum += b;
  const chk = sum.toString(8).padStart(6, "0").slice(-6);
  header.write(`${chk}\0 `, 148, 8, "ascii");
  return header;
}

/** Create a USTAR archive fully in memory. */
export function createTarBuffer(entries: TarEntry[]): Buffer {
  const mtimeSec = Math.floor(Date.now() / 1000);
  const chunks: Buffer[] = [];
  const used = new Set<string>();
  for (const rawEntry of entries) {
    let name = rawEntry.name;
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)}-${used.size + 1}${name.slice(dot)}` : `${name}-${used.size + 1}`;
    }
    used.add(name);
    const entry: TarEntry = { name, data: rawEntry.data };
    chunks.push(makeHeader(entry, mtimeSec));
    const padded = Math.ceil(entry.data.length / BLOCK) * BLOCK;
    const body = Buffer.alloc(padded);
    entry.data.copy(body, 0);
    chunks.push(body);
  }
  chunks.push(Buffer.alloc(BLOCK * 2)); // end-of-archive marker
  return Buffer.concat(chunks);
}

function readField(block: Buffer, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? slice.length : nul).toString("utf8");
}

function parseOctal(block: Buffer, offset: number, length: number): number {
  const raw = readField(block, offset, length).trim();
  if (!raw) return 0;
  const val = parseInt(raw, 8);
  if (!Number.isFinite(val) || val < 0) {
    throw new ConvertError("corrupt_file", "This archive is damaged or not a valid TAR file.");
  }
  return val;
}

function parsePax(buf: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  const str = buf.toString("utf8");
  let i = 0;
  while (i < str.length) {
    const space = str.indexOf(" ", i);
    if (space === -1) break;
    const len = parseInt(str.slice(i, space), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = str.slice(space + 1, i + len).replace(/\n$/, "");
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

/**
 * Read a TAR archive in memory.
 * Directory, symlink, hardlink, device and other special entries are skipped.
 */
export function readTarBuffer(buf: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingLongName: string | null = null;
  let pendingPaxPath: string | null = null;
  let sawHeader = false;

  while (offset + BLOCK <= buf.length) {
    const header = buf.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break;

    // Verify checksum so random bytes are rejected as corrupt archives.
    const stored = parseOctal(header, 148, 8);
    const withSpaces = Buffer.from(header);
    withSpaces.write("        ", 148, 8, "ascii");
    let sum = 0;
    for (const b of withSpaces) sum += b;
    if (stored !== sum) {
      throw new ConvertError("corrupt_file", "This archive is damaged or not a valid TAR file.");
    }
    sawHeader = true;

    const nameField = readField(header, 0, 100);
    const prefix = readField(header, 345, 155);
    const size = parseOctal(header, 124, 12);
    const typeflagRaw = header[156] ?? 0;
    const typeflag = typeflagRaw === 0 ? "0" : String.fromCharCode(typeflagRaw);

    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > buf.length) {
      throw new ConvertError("corrupt_file", "This archive is truncated or damaged.");
    }
    const body = buf.subarray(dataStart, dataEnd);
    const next = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (typeflag === "x" || typeflag === "g") {
      if (typeflag === "x") {
        const pax = parsePax(body);
        if (pax.path) pendingPaxPath = pax.path;
      }
      offset = next;
      continue;
    }
    if (typeflag === "L") {
      pendingLongName = body.toString("utf8").replace(/\0+$/, "");
      offset = next;
      continue;
    }
    if (typeflag === "K") {
      offset = next;
      continue;
    }

    const fullName = pendingPaxPath ?? pendingLongName ?? (prefix ? `${prefix}/${nameField}` : nameField);
    pendingPaxPath = null;
    pendingLongName = null;

    if (typeflag === "0" || typeflag === "7") {
      entries.push({ name: fullName, data: Buffer.from(body) });
    }
    // '5' dirs and '1'/'2' links / devices are intentionally skipped.
    offset = next;
  }

  if (!sawHeader) {
    throw new ConvertError("corrupt_file", "This file is not a valid TAR archive.");
  }
  return entries;
}
