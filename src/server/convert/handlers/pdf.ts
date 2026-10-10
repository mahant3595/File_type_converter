import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createCanvas } from "canvas";
import { Document, Packer, Paragraph, PageBreak } from "docx";
import type { ConversionHandler, OutputFile } from "../types";
import { ConvertError, toConvertError } from "../errors";
import { resolveOptions } from "@/lib/catalog";
import { parsePageRanges, stripExtension } from "@/lib/validate";

/* ------------------------------ pdfjs setup ------------------------------ */

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
let fontRoot: string | null = null;

function resolveFontRoot(): string {
  if (fontRoot) return fontRoot;
  const req = createRequire(path.join(process.cwd(), "package.json"));
  fontRoot = path.dirname(req.resolve("pdfjs-dist/package.json"));
  return fontRoot;
}

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

async function openPdf(data: Buffer) {
  const pdfjs = await loadPdfjs();
  const root = resolveFontRoot();
  return pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    standardFontDataUrl: `${pathToFileURL(path.join(root, "standard_fonts")).href}/`,
    cMapUrl: `${pathToFileURL(path.join(root, "cmaps")).href}/`,
    cMapPacked: true,
    verbosity: 0,
  }).promise;
}

/* ---------------------------- text extraction ---------------------------- */

interface TextLine {
  text: string;
  y: number;
  height: number;
}

type PdfDoc = Awaited<ReturnType<typeof openPdf>>;

function linesFromPage(page: Awaited<ReturnType<PdfDoc["getPage"]>>): Promise<TextLine[]> {
  return page.getTextContent().then((content) => {
    const lines: TextLine[] = [];
    for (const raw of content.items) {
      const item = raw as unknown as { str?: string; transform?: number[]; height?: number; width?: number };
      if (typeof item.str !== "string" || item.str === "") continue;
      const y = item.transform?.[5] ?? 0;
      const h = Math.abs(item.height ?? item.transform?.[3] ?? 10) || 10;
      const prev = lines[lines.length - 1];
      if (prev && Math.abs(prev.y - y) < Math.max(2, h * 0.4)) {
        const needsSpace =
          prev.text.length > 0 && !prev.text.endsWith(" ") && !item.str.startsWith(" ");
        prev.text += (needsSpace ? " " : "") + item.str;
        prev.height = Math.max(prev.height, h);
      } else {
        lines.push({ text: item.str, y, height: h });
      }
    }
    return lines;
  });
}
function splitIntoParagraphs(lines: TextLine[]): string[] {
  const paragraphs: string[] = [];
  let current = "";
  let prevY: number | null = null;
  let prevH = 10;
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text) {
      if (current) paragraphs.push(current);
      current = "";
      prevY = null;
      continue;
    }
    const bigGap = prevY !== null && prevY - line.y > Math.max(6, prevH * 1.8);
    if (bigGap && current) {
      paragraphs.push(current);
      current = text;
    } else {
      current = current ? `${current} ${text}` : text;
    }
    prevY = line.y;
    prevH = line.height;
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

/* ------------------------------- handlers -------------------------------- */

/** PDF → JPG/PNG, one output file per selected page. */
const pdfRender: ConversionHandler = {
  id: "pdf-render",
  maxBytesPerFile: 100 * 1024 * 1024,
  maxFiles: 1,
  maxOutputs: 60,
  async run({ tool, files, options }) {
    const file = files[0];
    if (!file) throw new ConvertError("invalid_file", "No PDF file was provided.");
    const opts = resolveOptions(tool, options);
    const dpi = Number(opts.dpi ?? 150);
    const scale = dpi / 72;
    const asPng = tool.output === "png";
    const base = stripExtension(file.name);

    let doc: PdfDoc;
    try {
      doc = await openPdf(file.data);
    } catch (e) {
      throw toConvertError(e, "This PDF could not be opened. It may be damaged or password-protected.");
    }
    try {
      const pageCount = doc.numPages;
      const spec = String(opts.pages ?? "").trim();
      let ranges;
      try {
        ranges = parsePageRanges(spec, pageCount);
      } catch (e) {
        throw new ConvertError("invalid_file", e instanceof Error ? e.message : "Invalid page selection.");
      }
      const selected: number[] = [];
      for (const r of ranges) {
        for (let p = r.start; p <= r.end; p++) selected.push(p);
      }
      if (selected.length === 0) throw new ConvertError("invalid_file", "No pages selected.");
      if (selected.length > 60) {
        throw new ConvertError("too_many_files", "Please convert at most 60 pages at a time.");
      }

      const outputs: OutputFile[] = [];
      for (const n of selected) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const raw = canvas.toBuffer("image/png");
        const encoded = asPng
          ? await sharp(raw).png({ compressionLevel: 9 }).toBuffer()
          : await sharp(raw).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        outputs.push({
          name: `${base}-page-${n}.${tool.output}`,
          mime: tool.outputMime,
          data: encoded,
        });
        await page.cleanup();
      }
      return outputs;
    } catch (e) {
      throw toConvertError(e, "This PDF page could not be rendered. It may use an unsupported feature.");
    } finally {
      await doc.cleanup();
    }
  },
};

/** PDF → TXT: plain text of every page. */
const pdfText: ConversionHandler = {
  id: "pdf-text",
  maxBytesPerFile: 100 * 1024 * 1024,
  maxFiles: 1,
  maxOutputs: 1,
  async run({ files }) {
    const file = files[0];
    if (!file) throw new ConvertError("invalid_file", "No PDF file was provided.");
    let doc: PdfDoc;
    try {
      doc = await openPdf(file.data);
    } catch (e) {
      throw toConvertError(e, "This PDF could not be opened. It may be damaged or password-protected.");
    }
    try {
      const pageTexts: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const lines = await linesFromPage(page);
        pageTexts.push(lines.map((l) => l.text).join("\n"));
        await page.cleanup();
      }
      const text = pageTexts.join("\n\n").replace(/[ \t]+\n/g, "\n").trimEnd() + "\n";
      if (!text.trim()) {
        throw new ConvertError(
          "conversion_failed",
          "No selectable text was found — this PDF may contain only scanned images.",
        );
      }
      return [{ name: `${stripExtension(file.name)}.txt`, mime: "text/plain", data: Buffer.from(text, "utf8") }];
    } finally {
      await doc.cleanup();
    }
  },
};

/** PDF → DOCX: text-level extraction into an editable Word document. */
const pdfToDocx: ConversionHandler = {
  id: "pdf-to-docx",
  maxBytesPerFile: 100 * 1024 * 1024,
  maxFiles: 1,
  maxOutputs: 1,
  async run({ tool, files }) {
    const file = files[0];
    if (!file) throw new ConvertError("invalid_file", "No PDF file was provided.");
    let doc: PdfDoc;
    try {
      doc = await openPdf(file.data);
    } catch (e) {
      throw toConvertError(e, "This PDF could not be opened. It may be damaged or password-protected.");
    }
    try {
      const children: Paragraph[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const lines = await linesFromPage(page);
        const paragraphs = splitIntoParagraphs(lines);
        for (const text of paragraphs) children.push(new Paragraph({ text }));
        if (children.length > 0 && n < doc.numPages) children.push(new Paragraph({ children: [new PageBreak()] }));
        await page.cleanup();
      }
      if (children.length === 0) {
        throw new ConvertError(
          "conversion_failed",
          "No selectable text was found — this PDF may contain only scanned images.",
        );
      }
      const outFile = new Document({ sections: [{ children }] });
      const bytes = await Packer.toBuffer(outFile);
      return [
        {
          name: `${stripExtension(file.name)}.docx`,
          mime: tool.outputMime,
          data: Buffer.from(bytes),
        },
      ];
    } finally {
      await doc.cleanup();
    }
  },
};

/** Merge PDFs in order → one file. */
const pdfMerge: ConversionHandler = {
  id: "pdf-merge",
  maxBytesPerFile: 100 * 1024 * 1024,
  maxFiles: 30,
  maxOutputs: 1,
  async run({ tool, files }) {
    if (files.length < 2) {
      throw new ConvertError("invalid_file", "Select at least two PDF files to merge.");
    }
    try {
      const out = await PDFDocument.create();
      for (const file of files) {
        const src = await PDFDocument.load(file.data, { updateMetadata: false });
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const p of pages) out.addPage(p);
      }
      const bytes = await out.save();
      return [{ name: "merged.pdf", mime: tool.outputMime, data: Buffer.from(bytes) }];
    } catch (e) {
      throw toConvertError(e, "One of the PDFs could not be read. It may be password-protected or damaged.");
    }
  },
};

/** Split a PDF by page ranges → one file per range. */
const pdfSplit: ConversionHandler = {
  id: "pdf-split",
  maxBytesPerFile: 100 * 1024 * 1024,
  maxFiles: 1,
  maxOutputs: 50,
  async run({ tool, files, options }) {
    const file = files[0];
    if (!file) throw new ConvertError("invalid_file", "No PDF file was provided.");
    const opts = resolveOptions(tool, options);
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(file.data, { updateMetadata: false });
    } catch (e) {
      throw toConvertError(e, "This PDF could not be opened. It may be password-protected or damaged.");
    }
    let ranges;
    try {
      ranges = parsePageRanges(String(opts.ranges ?? ""), src.getPageCount());
    } catch (e) {
      throw new ConvertError("invalid_file", e instanceof Error ? e.message : "Invalid page ranges.");
    }
    if (ranges.length > 50) throw new ConvertError("too_many_files", "Too many ranges (maximum 50).");
    const base = stripExtension(file.name);
    const outputs: OutputFile[] = [];
    const used = new Set<string>();
    for (const r of ranges) {
      const out = await PDFDocument.create();
      const pages = await out.copyPages(
        src,
        Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start - 1 + i),
      );
      for (const p of pages) out.addPage(p);
      const bytes = await out.save();
      let name =
        r.start === r.end ? `${base}-page-${r.start}.pdf` : `${base}-pages-${r.start}-${r.end}.pdf`;
      if (used.has(name)) name = name.replace(/\.pdf$/, `-${used.size + 1}.pdf`);
      used.add(name);
      outputs.push({ name, mime: tool.outputMime, data: Buffer.from(bytes) });
    }
    return outputs;
  },
};

export const pdfHandlers: ConversionHandler[] = [pdfRender, pdfText, pdfToDocx, pdfMerge, pdfSplit];
export { openPdf, linesFromPage };
