/**
 * End-to-end verification against a running NEXORA Convert server.
 * Usage: BASE_URL=http://localhost:3000 node scripts/verify-deployed.mjs
 * Exercises routes, SSR content, SEO/a11y markers and REAL conversions.
 */
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
let currentGroup = "";

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
async function html(path) {
  const res = await fetch(BASE + path);
  const body = await res.text();
  return { res, body };
}
function toolLinks(body) {
  return [...new Set([...body.matchAll(/href="\/convert\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
}

/* fixtures */
async function makeJpg() {
  const raw = Buffer.alloc(80 * 60 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
  return sharp(raw, { raw: { width: 80, height: 60, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}
async function makePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 200]);
  page.drawText("HELLO E2E", { x: 24, y: 110, size: 18, font, color: rgb(0, 0, 0) });
  return Buffer.from(await doc.save());
}
function makeWav() {
  const sampleRate = 8000, n = sampleRate / 2, dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000), 44 + i * 2);
  return buf;
}
async function convert(tool, files, options = {}) {
  const form = new FormData();
  form.set("tool", tool);
  form.set("options", JSON.stringify(options));
  for (const [name, data] of files) {
    form.append("files", new File([new Uint8Array(data)], name, { type: "application/octet-stream" }));
  }
  const res = await fetch(`${BASE}/api/convert`, { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  return { res, json };
}

/* ------------------------------- checks -------------------------------- */

group("home");
await check("renders the dashboard", async () => {
  const { res, body } = await html("/");
  assert(res.status === 200, `status ${res.status}`);
  assert(res.headers.get("content-type")?.includes("text/html"), "content-type");
  assert(body.includes('<html lang="en"'), "lang attribute");
  assert(body.includes("Every File. Any Format."), "headline");
  assert(body.includes("Discover powerful file conversion tools"), "hero copy");
  assert(body.includes("Skip to main content"), "skip link");
  assert(body.includes('role="combobox"'), "search combobox");
  assert(body.includes("Popular Conversions"), "popular strip");
  assert(body.includes("All conversion tools"), "directory");
  assert(body.includes("aria-pressed"), "category filters");
  assert(/stored only in this browser/i.test(body), "browser-local note");
});
await check("lists only genuinely available tools", async () => {
  const { body } = await html("/");
  const home = toolLinks(body);
  assert(home.length >= 50, `expected ≥50 tools, got ${home.length}`);
  for (const id of ["jpg-to-png", "pdf-to-word", "mp4-to-mp3", "csv-to-xlsx", "pptx-to-txt", "merge-pdf", "extract-zip"])
    assert(home.includes(id), `missing ${id}`);
  for (const banned of ["heic-to-jpg", "word-to-pdf", "doc-to-pdf", "rar-to-zip", "ppt-to-pdf"])
    assert(!home.includes(banned), `advertised unavailable tool ${banned}`);
  // sitemap must match the homepage exactly (no orphan/hidden tools)
  const { body: sm } = await html("/sitemap.xml");
  const smTools = [...new Set([...sm.matchAll(/\/convert\/([a-z0-9-]+)</g)].map((m) => m[1]))];
  const missing = home.filter((t) => !smTools.includes(t));
  assert(missing.length === 0, `sitemap missing: ${missing.join(",")}`);
});

group("search & discovery");
await check("/tools?q= deep-link filters", async () => {
  const { body } = await html("/tools?q=" + encodeURIComponent("jpg to png"));
  assert(body.includes("JPG to PNG"), "result present");
  assert(body.includes("matching"), "result summary");
});
await check("unsupported query shows honest empty state", async () => {
  const { body } = await html("/tools?q=" + encodeURIComponent("heic to jpg"));
  assert(body.includes("No tools match"), "empty state rendered");
  assert(!body.includes("/convert/heic"), "no fake tool link");
});

group("tool landing page");
await check("/convert/jpg-to-png is a complete landing page", async () => {
  const { res, body } = await html("/convert/jpg-to-png");
  assert(res.status === 200, `status ${res.status}`);
  assert(/<title>[^<]*JPG to PNG[^<]*<\/title>/.test(body), "title");
  assert(body.includes('rel="canonical"'), "canonical");
  assert(body.includes("Drag &amp; drop") || body.includes("Drag & drop"), "dropzone");
  assert(body.includes("processed by our conversion engine on our server"), "honest privacy disclosure");
  assert(body.includes("Related conversions"), "related tools");
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(body);
  assert(ld, "JSON-LD missing");
  const parsed = JSON.parse(ld[1]);
  assert(parsed["@type"] === "FAQPage" && parsed.mainEntity.length >= 3, "FAQPage JSON-LD");
  assert(body.includes('aria-current="page"'), "breadcrumb");
});
await check("unavailable tools 404", async () => {
  for (const p of ["/convert/heic-to-jpg", "/convert/word-to-pdf", "/convert/not-a-tool"]) {
    const { res } = await html(p);
    assert(res.status === 404, `${p} → ${res.status}`);
  }
});

group("pages");
await check("category, legal, help, 404, sitemap, robots", async () => {
  for (const p of ["/category/images", "/category/pdf", "/category/audio-video", "/help", "/privacy", "/terms", "/favorites", "/convert", "/tools"]) {
    const { res } = await html(p);
    assert(res.status === 200, `${p} → ${res.status}`);
  }
  const nf = await html("/definitely-not-here");
  assert(nf.res.status === 404, "custom 404 status");
  assert(nf.body.includes("Page not found") && nf.body.includes('role="combobox"'), "404 content + search");
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  assert(robots.includes("Sitemap:"), "robots sitemap");
});

group("design system");
await check("tokens, focus states and reduced motion are shipped", async () => {
  const { body } = await html("/");
  const cssHref = /href="(\/_next\/static\/[^"]+\.css)"/.exec(body)?.[1];
  assert(cssHref, "stylesheet link missing");
  const css = await (await fetch(BASE + cssHref)).text();
  for (const token of ["#09090b", "#17171f", "#8b5cf6", "#22d3ee", "#a1a1aa", "#2b2b36"])
    assert(css.toLowerCase().includes(token), `token ${token} missing`);
  assert(css.includes("focus-visible"), "focus-visible styles");
  assert(css.includes("prefers-reduced-motion"), "reduced motion");
});

/* ----------------------- real conversions over HTTP --------------------- */

group("conversion API");
await check("JPG → PNG (single)", async () => {
  const { res, json } = await convert("jpg-to-png", [["photo.jpg", await makeJpg()]]);
  assert(res.status === 200, `status ${res.status}: ${JSON.stringify(json)}`);
  assert(json.outputs.length === 1, "one output");
  assert(json.outputs[0].name === "photo.png", `name ${json.outputs[0].name}`);
  const buf = Buffer.from(json.outputs[0].data, "base64");
  const meta = await sharp(buf).metadata();
  assert(meta.format === "png" && meta.width === 80, "real png output");
  assert(res.headers.get("cache-control") === "no-store", "no-store");
});
await check("JPG → PNG (batch of 2)", async () => {
  const jpg = await makeJpg();
  const { json } = await convert("jpg-to-png", [["a.jpg", jpg], ["a.jpg", jpg]]);
  assert(json.outputs.length === 2, "two outputs");
  assert(new Set(json.outputs.map((o) => o.name)).size === 2, "unique names");
});
await check("PDF → TXT extracts text", async () => {
  const { json } = await convert("pdf-to-txt", [["doc.pdf", await makePdf()]]);
  assert(Buffer.from(json.outputs[0].data, "base64").toString().includes("HELLO E2E"), "text content");
});
await check("CSV → XLSX creates a workbook", async () => {
  const csv = "name,qty\nwidget,5\n";
  const { json } = await convert("csv-to-xlsx", [["data.csv", Buffer.from(csv)]]);
  const wb = XLSX.read(Buffer.from(json.outputs[0].data, "base64"), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  assert(rows[0].qty === 5, "cell data");
});
await check("WAV → MP3 (ffmpeg engine)", async () => {
  const { json } = await convert("wav-to-mp3", [["tone.wav", makeWav()]], { bitrate: "192k" });
  const buf = Buffer.from(json.outputs[0].data, "base64");
  assert(buf.length > 1000 && (buf[0] === 0x49 || buf.subarray(0, 3).toString() === "ID3"), "mp3 bytes");
});
await check("wrong extension rejected with helpful message", async () => {
  const { res, json } = await convert("jpg-to-png", [["notes.txt", Buffer.from("hello")]]);
  assert(res.status === 422, `status ${res.status}`);
  assert(json.error?.message.includes("accepts JPG"), `message: ${json.error?.message}`);
});
await check("lying extension rejected by signature check", async () => {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } }).png().toBuffer();
  const { res, json } = await convert("jpg-to-png", [["lying.jpg", png]]);
  assert(res.status === 422, `status ${res.status}`);
  assert(/contains PNG data/i.test(json.error?.message), `message: ${json.error?.message}`);
});
await check("unknown tool → 404", async () => {
  const { res, json } = await convert("heic-to-jpg", [["a.heic", Buffer.from("x")]]);
  assert(res.status === 404 && json.error?.code === "unknown_tool", `status ${res.status}`);
});
await check("batch merge (Merge PDF)", async () => {
  const pdf = await makePdf();
  const { res, json } = await convert("merge-pdf", [["a.pdf", pdf], ["b.pdf", pdf]]);
  assert(res.status === 200, `status ${res.status}`);
  assert(json.outputs[0].name === "merged.pdf", "merged name");
  const doc = await PDFDocument.load(Buffer.from(json.outputs[0].data, "base64"));
  assert(doc.getPageCount() === 2, "page count");
});
await check("batch ZIP archive creation", async () => {
  const { json } = await convert("files-to-zip", [["a.txt", Buffer.from("alpha")], ["b.txt", Buffer.from("beta")]]);
  const buf = Buffer.from(json.outputs[0].data, "base64");
  assert(buf.subarray(0, 2).toString() === "PK", "zip magic");
});

/* ------------------------------- report -------------------------------- */

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.label}${r.ok ? "" : ` — ${r.err}`}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
