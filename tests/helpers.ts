import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { ffmpegPath } from "@/server/convert/capabilities";

export function randomPixels(width: number, height: number): Buffer {
  const buf = Buffer.alloc(width * height * 3);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

export async function makePng(width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#3355ff" } })
    .png()
    .toBuffer();
}

export async function makeJpg(width = 80, height = 60): Promise<Buffer> {
  return sharp(randomPixels(width, height), { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function makeWebp(width = 40, height = 30): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#20c997" } }).webp().toBuffer();
}

export async function makeGif(): Promise<Buffer> {
  return sharp(randomPixels(32, 32), { raw: { width: 32, height: 32, channels: 3 } })
    .gif()
    .toBuffer();
}

export async function makeTiff(): Promise<Buffer> {
  return sharp({ create: { width: 24, height: 24, channels: 3, background: "#aa33ff" } })
    .tiff()
    .toBuffer();
}

export async function makeAvif(): Promise<Buffer> {
  return sharp({ create: { width: 32, height: 32, channels: 3, background: "#ff8800" } })
    .avif({ quality: 60 })
    .toBuffer();
}

export const SVG_SAMPLE = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8b5cf6"/><circle cx="20" cy="15" r="8" fill="#22d3ee"/></svg>`,
);

export async function makeDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Quarterly Report", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun("Revenue grew by 14 percent.")] }),
          new Paragraph({ text: "Notes", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun("All systems operational.")] }),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function makePdfWithText(pages = 2): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([300, 200]);
    page.drawText(`HELLO NEXORA PAGE ${i}`, { x: 24, y: 110, size: 16, font, color: rgb(0.05, 0.05, 0.2) });
    page.drawLine({ start: { x: 24, y: 96 }, end: { x: 260, y: 96 }, thickness: 2, color: rgb(0.5, 0.2, 0.8) });
  }
  return Buffer.from(await doc.save());
}

export async function makePdfBlank(pages = 3): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 100]);
  return Buffer.from(await doc.save());
}

export function makeCsv(): Buffer {
  return Buffer.from("name,qty,price\nwidget,5,9.99\ngadget,2,14.5\n", "utf8");
}

export async function makeXlsx(): Promise<Buffer> {
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "qty"],
    ["widget", 5],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export async function makeXls(): Promise<Buffer> {
  const ws = XLSX.utils.aoa_to_sheet([["city", "pop"], ["Lima", 10]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "biff8" }));
}

export async function makeOds(): Promise<Buffer> {
  const ws = XLSX.utils.aoa_to_sheet([["a", "b"], [1, 2]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "ods" }));
}

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Quarterly Review</a:t></a:r></a:p><a:p><a:r><a:t>Revenue up 14%</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

export function makePptx(slideCount = 2): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`),
  );
  for (let i = 1; i <= slideCount; i++) {
    zip.addFile(`ppt/slides/slide${i}.xml`, Buffer.from(SLIDE_XML.replace("Revenue up 14%", `Revenue up ${i * 14}%`)));
  }
  return zip.toBuffer();
}

export function makeZip(files: { name: string; data: Buffer | string }[]): Buffer {
  const zip = new AdmZip();
  for (const f of files) zip.addFile(f.name, Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data));
  return zip.toBuffer();
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nexora-test-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function makeWav(): Promise<Buffer> {
  const ff = await ffmpegPath();
  return withTmp(async (dir) => {
    const out = path.join(dir, "a.wav");
    execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-y", out]);
    return readFile(out);
  });
}

export async function makeMp3(): Promise<Buffer> {
  const ff = await ffmpegPath();
  return withTmp(async (dir) => {
    const out = path.join(dir, "a.mp3");
    execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=1", "-y", out]);
    return readFile(out);
  });
}

export async function makeMp4(): Promise<Buffer> {
  const ff = await ffmpegPath();
  return withTmp(async (dir) => {
    const out = path.join(dir, "a.mp4");
    execFileSync(ff, [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=10",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-y", out,
    ]);
    return readFile(out);
  });
}

export { withTmp, writeFile, readFile };

/** Opus audio inside an Ogg container — file-type sniffs this as "opus". */
export async function makeOggOpus(): Promise<Buffer> {
  const ff = await ffmpegPath();
  return withTmp(async (dir) => {
    const out = path.join(dir, "a.ogg");
    execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libopus", "-y", out]);
    return readFile(out);
  });
}

/** M4A written with the ipod brand — file-type sniffs this as "m4v". */
export async function makeM4vBrandM4a(): Promise<Buffer> {
  const ff = await ffmpegPath();
  return withTmp(async (dir) => {
    const out = path.join(dir, "a.m4a");
    execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "aac", "-f", "ipod", "-y", out]);
    return readFile(out);
  });
}

export async function makeAnimatedGif(): Promise<Buffer> {
  const ff = await ffmpegPath();
  return withTmp(async (dir) => {
    const out = path.join(dir, "anim.gif");
    execFileSync(ff, [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "testsrc=duration=1:size=64x48:rate=10",
      "-y", out,
    ]);
    return readFile(out);
  });
}
