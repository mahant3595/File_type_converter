import AdmZip from "adm-zip";
import { fileTypeFromBuffer } from "file-type";
import { createTarBuffer, readTarBuffer, type TarEntry } from "../tarbuf";
import type { ConversionHandler, OutputFile } from "../types";
import { ConvertError, toConvertError } from "../errors";
import { sanitizeEntryPath, sanitizeFilename, stripExtension } from "@/lib/validate";

const MAX_ENTRIES = 500;
const MAX_TOTAL_BYTES = 400 * 1024 * 1024;

function zipToEntries(zip: AdmZip): TarEntry[] {
  const out: TarEntry[] = [];
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    // Skip symlinks (unix mode in high 16 bits of external attributes).
    const unixMode = (e.attr ?? 0) >>> 16;
    if ((unixMode & 0xf000) === 0xa000) continue;
    const safe = sanitizeEntryPath(e.entryName);
    if (!safe) continue;
    out.push({ name: safe, data: e.getData() });
    if (out.length > MAX_ENTRIES) {
      throw new ConvertError("too_many_files", `This archive contains more than ${MAX_ENTRIES} files.`);
    }
  }
  return out;
}

function entriesToZip(entries: TarEntry[]): Buffer {
  const zip = new AdmZip();
  const used = new Set<string>();
  for (const entry of entries) {
    let name = entry.name;
    if (used.has(name.toLowerCase())) name = `${stripExtension(name)}-dup${used.size}.bin`;
    used.add(name.toLowerCase());
    zip.addFile(name, entry.data);
  }
  return zip.toBuffer();
}

function guardTotals(entries: TarEntry[]): void {
  if (entries.length === 0) {
    throw new ConvertError("invalid_file", "This archive is empty or contains no regular files.");
  }
  if (entries.length > MAX_ENTRIES) {
    throw new ConvertError("too_many_files", `This archive contains more than ${MAX_ENTRIES} files.`);
  }
  const total = entries.reduce((sum, e) => sum + e.data.length, 0);
  if (total > MAX_TOTAL_BYTES) {
    throw new ConvertError("too_large", "The extracted content is too large (limit 400 MB).");
  }
}

async function withMime(entry: TarEntry): Promise<OutputFile> {
  let mime = "application/octet-stream";
  try {
    const ft = await fileTypeFromBuffer(entry.data);
    if (ft?.mime) mime = ft.mime;
    else if (/\.(txt|csv|md|json|log|xml|html)$/i.test(entry.name)) mime = "text/plain";
  } catch {
    /* sniffing is best effort */
  }
  return { name: entry.name, mime, data: entry.data };
}

/** Create ZIP/TAR from any files. */
const archiveCreate: ConversionHandler = {
  id: "archive-create",
  maxBytesPerFile: 250 * 1024 * 1024,
  maxFiles: 100,
  maxOutputs: 1,
  async run({ tool, files }) {
    if (files.length === 0) throw new ConvertError("invalid_file", "Select at least one file to archive.");
    const used = new Set<string>();
    const entries: TarEntry[] = files.map((file, i) => {
      const base = sanitizeFilename(file.name, `file-${i + 1}`);
      let name = base;
      if (used.has(name.toLowerCase())) name = `${stripExtension(base)}-${used.size + 1}`;
      used.add(name.toLowerCase());
      return { name, data: file.data };
    });
    const isZip = tool.output === "zip";
    const data = isZip ? entriesToZip(entries) : createTarBuffer(entries);
    const name =
      entries.length === 1
        ? `${stripExtension(entries[0]!.name)}.${tool.output}`
        : `files.${tool.output}`;
    return [{ name, mime: tool.outputMime, data }];
  },
};

/** ZIP ↔ TAR. */
const archiveConvert: ConversionHandler = {
  id: "archive-convert",
  maxBytesPerFile: 250 * 1024 * 1024,
  maxFiles: 10,
  async run({ tool, files }) {
    const outputs: OutputFile[] = [];
    const used = new Set<string>();
    for (const file of files) {
      let entries: TarEntry[];
      try {
        if (/\.zip$/i.test(file.name)) {
          entries = zipToEntries(new AdmZip(file.data));
        } else {
          entries = readTarBuffer(file.data);
        }
      } catch (e) {
        if (e instanceof ConvertError) throw e;
        throw toConvertError(e, `"${file.name}" is not a valid archive, or it is damaged.`);
      }
      guardTotals(entries);
      let data: Buffer;
      try {
        data = tool.output === "zip" ? entriesToZip(entries) : createTarBuffer(entries);
      } catch (e) {
        if (e instanceof ConvertError) throw e;
        throw toConvertError(e, `"${file.name}" could not be repacked.`);
      }
      let name = `${stripExtension(file.name)}.${tool.output}`;
      if (used.has(name.toLowerCase())) name = `${stripExtension(file.name)}-${used.size + 1}.${tool.output}`;
      used.add(name.toLowerCase());
      outputs.push({ name, mime: tool.outputMime, data });
    }
    return outputs;
  },
};

/** ZIP/TAR → individual files. */
const archiveExtract: ConversionHandler = {
  id: "archive-extract",
  maxBytesPerFile: 250 * 1024 * 1024,
  maxFiles: 1,
  async run({ files }) {
    const file = files[0];
    if (!file) throw new ConvertError("invalid_file", "No archive was provided.");
    let entries: TarEntry[];
    try {
      if (/\.zip$/i.test(file.name)) {
        entries = zipToEntries(new AdmZip(file.data));
      } else {
        entries = readTarBuffer(file.data).map((e) => ({
          name: sanitizeEntryPath(e.name) ?? "",
          data: e.data,
        }));
      }
    } catch (e) {
      if (e instanceof ConvertError) throw e;
      throw toConvertError(e, `"${file.name}" is not a valid archive, or it is damaged.`);
    }
    const safeEntries = entries.filter((e) => e.name);
    guardTotals(safeEntries);
    const outputs: OutputFile[] = [];
    for (const entry of safeEntries) outputs.push(await withMime(entry));
    return outputs;
  },
};

export const archiveHandlers: ConversionHandler[] = [archiveCreate, archiveConvert, archiveExtract];
