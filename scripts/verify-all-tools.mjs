/**
 * Exhaustive per-tool verification against a running NEXORA Convert server.
 * Usage: BASE_URL=http://localhost:3000 node scripts/verify-all-tools.mjs
 *
 * For EVERY tool the UI advertises (taken from the homepage, i.e. what users
 * actually see): builds a real fixture for its input format, converts through
 * POST /api/convert with non-default settings where declared, and validates
 * the outputs — name, extension, magic bytes / text content, output count.
 * Also checks every /convert/[tool] landing page renders.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import AdmZip from "adm-zip";
import ffmpegPath from "ffmpeg-static";
import { fileTypeFromBuffer } from "file-type";

import { TOOLS } from "../src/lib/catalog.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
let currentGroup = "";
const tmpDirs = [];

function group(name) { currentGroup = name; }
async function check(name, fn) {
  const label = currentGroup ? `${currentGroup} › ${name}` : name;
  try {
    await fn();
    results.push({ label, ok: true });
  } catch (e) {
    results.push({ label, ok: false, err: e instanceof Error ? e.message : String(e) });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function tmp() {
  const d = await mkdtemp(path.join(os.tmpdir(), "nexora-sweep-"));
  tmpDirs.push(d);
  return d;
}
function ffmpeg(args) {
  try {
    execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    throw new Error(`ffmpeg failed: ${String(e.stderr ?? e.message).trim().slice(0, 300)}`);
  }
}
function noise(w, h) {
  const b = Buffer.alloc(w * h * 3);
  for (let i = 0; i < b.length; i++) b[i] = (i * 37) % 256;
  return b;
}

/* ------------------------------ fixtures ------------------------------- */

async function makePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 6; i++) {
    const page = doc.addPage([300, 200]);
    page.drawText(`NEXORA SWEEP PAGE ${i}`, { x: 24, y: 110, size: 14, font, color: rgb(0.05, 0.05, 0.2) });
  }
  return Buffer.from(await doc.save());
}
async function makeDocx() {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "Sweep Report", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun("NEXORA SWEEP DOC body content.")] }),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
async function makeXlsx() {
  const ws = XLSX.utils.aoa_to_sheet([["name", "qty"], ["widget", 5], ["gadget", 2]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
async function makeXls() {
  const ws = XLSX.utils.aoa_to_sheet([["city", "pop"], ["Lima", 10]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "biff8" }));
}
async function makeOds() {
  const ws = XLSX.utils.aoa_to_sheet([["a", "b"], [1, 2]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "ods" }));
}
function makePptx() {
  const slide = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Quarterly Review ${n}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`));
  for (let i = 1; i <= 2; i++) zip.addFile(`ppt/slides/slide${i}.xml`, Buffer.from(slide(i)));
  return zip.toBuffer();
}
function makeWav() {
  const sampleRate = 8000, n = sampleRate, dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000), 44 + i * 2);
  return buf;
}
async function makeZipBundle() {
  const zip = new AdmZip();
  zip.addFile("alpha.txt", Buffer.from("alpha content"));
  zip.addFile("readme.md", Buffer.from("# Read me\n"));
  return zip.toBuffer();
}
async function makeTarBundle() {
  const dir = await tmp();
  const a = path.join(dir, "alpha.txt"), b = path.join(dir, "readme.md");
  await writeFile(a, "alpha content");
  await writeFile(b, "# Read me\n");
  const out = path.join(dir, "bundle.tar");
  execFileSync("tar", ["--format=ustar", "--owner=0", "--group=0", "--numeric-owner", "-cf", out, "-C", dir, "alpha.txt", "readme.md"]);
  return readFile(out);
}
async function encode(ext) {
  const dir = await tmp();
  const out = path.join(dir, `f.${ext}`);
  const v = ["-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=10"];
  const a = ["-f", "lavfi", "-i", "sine=frequency=440:duration=1"];
  const short = ["-shortest"];
  switch (ext) {
    case "mp3": ffmpeg([...a, "-c:a", "libmp3lame", "-y", out]); break;
    case "flac": ffmpeg([...a, "-c:a", "flac", "-y", out]); break;
    case "ogg": ffmpeg([...a, "-c:a", "libvorbis", "-y", out]); break;
    case "m4a": ffmpeg([...a, "-c:a", "aac", "-y", out]); break;
    case "mp4": ffmpeg([...v, ...a, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", ...short, "-y", out]); break;
    case "webm": ffmpeg([...v, ...a, "-c:v", "libvpx", "-c:a", "libopus", ...short, "-y", out]); break;
    case "mov": ffmpeg([...v, ...a, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", ...short, "-f", "mov", "-y", out]); break;
    case "mkv": ffmpeg([...v, ...a, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", ...short, "-y", out]); break;
    case "avi": ffmpeg([...v, ...a, "-c:v", "mpeg4", "-c:a", "libmp3lame", ...short, "-y", out]); break;
    default: throw new Error(`no encoder for ${ext}`);
  }
  return readFile(out);
}

const FACTORIES = {
  jpg: () => sharp(noise(80, 60), { raw: { width: 80, height: 60, channels: 3 } }).jpeg({ quality: 90 }).toBuffer(),
  png: () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#3355ff" } }).png().toBuffer(),
  webp: () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#20c997" } }).webp().toBuffer(),
  gif: () => sharp(noise(32, 32), { raw: { width: 32, height: 32, channels: 3 } }).gif().toBuffer(),
  tiff: () => sharp({ create: { width: 24, height: 24, channels: 3, background: "#aa33ff" } }).tiff().toBuffer(),
  avif: () => sharp({ create: { width: 32, height: 32, channels: 3, background: "#ff8800" } }).avif({ quality: 60 }).toBuffer(),
  svg: () => Promise.resolve(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8b5cf6"/><circle cx="20" cy="15" r="8" fill="#22d3ee"/></svg>`)),
  pdf: makePdf,
  docx: makeDocx,
  txt: () => Promise.resolve(Buffer.from("alpha line one\nbeta line two\n")),
  md: () => Promise.resolve(Buffer.from("# Sweep Title\n\nSome **bold** body text.\n")),
  html: () => Promise.resolve(Buffer.from("<h1>Heading</h1><p>Body text.</p>")),
  csv: () => Promise.resolve(Buffer.from("name,qty,price\nwidget,5,9.99\ngadget,2,14.5\n")),
  xlsx: makeXlsx,
  xls: makeXls,
  ods: makeOds,
  pptx: () => Promise.resolve(makePptx()),
  wav: () => Promise.resolve(makeWav()),
  zip: makeZipBundle,
  tar: makeTarBundle,
};
for (const ext of ["mp3", "flac", "ogg", "m4a", "mp4", "webm", "mov", "mkv", "avi"]) {
  FACTORIES[ext] = () => encode(ext);
}
// alternate spellings of the same formats
FACTORIES.tif = FACTORIES.tiff;
FACTORIES.jpeg = FACTORIES.jpg;

const fixtureCache = new Map();
function fixture(ext) {
  if (!fixtureCache.has(ext)) {
    const f = FACTORIES[ext];
    if (!f) return Promise.reject(new Error(`no fixture factory for "${ext}"`));
    fixtureCache.set(ext, f());
  }
  return fixtureCache.get(ext);
}

/* ------------------------- options & expectations ---------------------- */

/** Non-default, still-in-range options — exercises the settings pipeline. */
function probeOptions(tool) {
  const opts = {};
  for (const s of tool.settings ?? []) {
    if (s.type === "number") {
      const step = s.step ?? 1;
      const min = s.min ?? 0;
      const max = s.max ?? Number.MAX_SAFE_INTEGER;
      const def = Number(s.defaultValue);
      let v = def + step;
      if (v > max) v = def - step;
      if (v < min) v = def;
      opts[s.key] = v;
    } else if (s.type === "select") {
      const list = s.options ?? [];
      const alt = list.find((o) => String(o.value) !== String(s.defaultValue));
      opts[s.key] = alt ? alt.value : s.defaultValue;
    } else {
      opts[s.key] = s.defaultValue; // text settings (page ranges) keep the documented default
    }
  }
  return opts;
}

function inputCount(tool) {
  const max = tool.maxFiles ?? 1;
  if (tool.multiInput) return Math.min(2, max);
  if (tool.batch && max >= 2) return 2;
  return Math.min(1, max);
}

const TEXT_EXTS = new Set(["txt", "md", "html", "csv", "json"]);
const SNIFF_WANT = {
  png: ["png"], jpg: ["jpg"], webp: ["webp"], gif: ["gif"], tiff: ["tif", "tiff"], avif: ["avif"],
  pdf: ["pdf"],
  zip: ["zip", "xlsx", "docx", "ods"], xlsx: ["xlsx", "zip"], docx: ["zip", "docx"], ods: ["ods", "zip"],
  wav: ["wav"], mp3: ["mp3"], flac: ["flac"], ogg: ["ogg", "oga"], m4a: ["m4a", "mp4", "m4v"],
  mp4: ["mp4", "mov", "m4v"], webm: ["webm"],
};

async function validateOutput(ext, buf) {
  assert(buf.length > 0, `empty ${ext} output`);
  if (TEXT_EXTS.has(ext)) {
    const s = buf.toString("utf8");
    assert(s.trim().length > 0, `empty ${ext} text output`);
    assert(!s.includes("\uFFFD"), `${ext} output is not valid UTF-8`);
    if (ext === "json") JSON.parse(s);
    return;
  }
  if (ext === "tar") {
    assert(buf.subarray(257, 262).toString() === "ustar", "tar ustar magic missing");
    return;
  }
  const want = SNIFF_WANT[ext];
  if (!want) return; // unknown/unstructured extension — non-empty check above suffices
  const got = (await fileTypeFromBuffer(buf))?.ext;
  if (got && want.includes(got)) return;
  // mp3 may lack an ID3 header; accept a raw frame sync
  if (ext === "mp3" && (buf[0] === 0x49 || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))) return;
  throw new Error(`expected ${ext} output, sniffed ${got ?? "(nothing)"}`);
}

async function convert(toolId, files, options) {
  const form = new FormData();
  form.set("tool", toolId);
  form.set("options", JSON.stringify(options ?? {}));
  for (const [name, buf] of files) {
    form.append("files", new File([new Uint8Array(buf)], name, { type: "application/octet-stream" }));
  }
  const res = await fetch(`${BASE}/api/convert`, { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  return { res, json };
}

/* -------------------------------- sweep -------------------------------- */

const home = await fetch(BASE + "/").then((r) => r.text());
const advertised = [...new Set([...home.matchAll(/href="\/convert\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
const byId = new Map(TOOLS.map((t) => [t.id, t]));

group("coverage");
await check("every catalog tool is advertised (and vice versa)", async () => {
  const missing = TOOLS.filter((t) => !advertised.includes(t.id)).map((t) => t.id);
  const orphans = advertised.filter((id) => !byId.has(id));
  assert(missing.length === 0, `catalog tools missing from homepage: ${missing.join(", ")}`);
  assert(orphans.length === 0, `homepage links with no catalog entry: ${orphans.join(", ")}`);
  assert(advertised.length >= 50, `expected ≥50 tools, got ${advertised.length}`);
});

group("tool pages");
for (const id of advertised) {
  await check(`/${`convert/${id}`} renders`, async () => {
    const res = await fetch(`${BASE}/convert/${id}`);
    assert(res.status === 200, `status ${res.status}`);
    const body = await res.text();
    assert(body.includes(byId.get(id)?.name ?? "\u0000"), "tool name missing from landing page");
    assert(body.includes("Drag"), "dropzone missing");
  });
}

group("conversions");
const CONCURRENCY = 4;
const queue = [...advertised];
async function worker() {
  for (;;) {
    const id = queue.shift();
    if (!id) return;
    await check(`${id}`, async () => {
      const tool = byId.get(id);
      assert(tool, "not in catalog");
      const ext = tool.inputs.find((e) => e !== "*") ?? "txt";
      const n = inputCount(tool);
      const src = await fixture(ext);
      const files = [];
      for (let i = 0; i < n; i++) files.push([`sample-${i + 1}.${ext}`, src]);
      const options = probeOptions(tool);
      const { res, json } = await convert(id, files, options);
      assert(res.status === 200, `status ${res.status}: ${JSON.stringify(json?.error)}`);
      const outputs = json.outputs ?? [];
      assert(outputs.length >= 1, "no outputs");

      if (id === "extract-zip" || id === "extract-tar") {
        assert(outputs.length === 2, `expected 2 extracted files, got ${outputs.length}`);
        const names = outputs.map((o) => o.name);
        assert(names.includes("alpha.txt"), `alpha.txt missing in ${names.join(", ")}`);
        for (const o of outputs) await validateOutput(o.name.split(".").pop(), Buffer.from(o.data, "base64"));
        return;
      }
      const MULTI_OUTPUT = new Set(["pdf-to-jpg", "pdf-to-png"]);
      if (tool.multiInput) {
        assert(outputs.length === 1, `multi-input tool produced ${outputs.length} outputs`);
      } else if (MULTI_OUTPUT.has(id)) {
        // fixture PDF has 6 pages and the "pages" setting defaults to all of them
        assert(outputs.length === 6, `expected 6 page outputs, got ${outputs.length}`);
      } else if (id === "split-pdf") {
        assert(outputs.length === 2, `default ranges on a 6-page PDF → expected 2 outputs, got ${outputs.length}`);
      } else {
        assert(outputs.length === n, `expected ${n} outputs, got ${outputs.length}`);
      }
      const names = new Set(outputs.map((o) => o.name));
      assert(names.size === outputs.length, "output names are not unique");
      for (const o of outputs) {
        assert(typeof o.name === "string" && o.name.length > 0, "bad output name");
        if (tool.output !== "*") {
          assert(o.name.toLowerCase().endsWith(`.${tool.output}`), `name "${o.name}" should end in .${tool.output}`);
        }
        assert(o.size > 0, `size 0 for ${o.name}`);
        await validateOutput(o.name.split(".").pop(), Buffer.from(o.data, "base64"));
      }
      if (id === "pdf-to-txt") {
        const txt = Buffer.from(outputs[0].data, "base64").toString();
        assert(txt.includes("NEXORA SWEEP PAGE 1"), "extracted text missing");
      }
      if (id === "split-pdf") {
        const { PDFDocument } = await import("pdf-lib");
        let pages = 0;
        for (const o of outputs) pages += (await PDFDocument.load(Buffer.from(o.data, "base64"))).getPageCount();
        assert(pages === 6, `split outputs cover ${pages} pages, expected 6`);
      }
      if (id === "merge-pdf") {
        const { PDFDocument } = await import("pdf-lib");
        const doc = await PDFDocument.load(Buffer.from(outputs[0].data, "base64"));
        assert(doc.getPageCount() === 12, `merged page count ${doc.getPageCount()}, expected 12`);
      }
    });
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

/* -------------------------------- report -------------------------------- */

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.label}${r.ok ? "" : ` — ${r.err}`}`);
console.log(`\n${passed}/${results.length} checks passed`);
await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true }).catch(() => undefined)));
process.exit(failed.length ? 1 : 0);
