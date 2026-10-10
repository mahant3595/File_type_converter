import mammoth from "mammoth";
import TurndownService from "turndown";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { ConversionHandler, OutputFile } from "../types";
import { ConvertError, toConvertError } from "../errors";
import { stripExtension } from "@/lib/validate";

function baseName(name: string): string {
  return stripExtension(name);
}

/** DOCX → TXT / Markdown / HTML (mammoth + turndown). */
const docxConvert: ConversionHandler = {
  id: "docx-convert",
  maxBytesPerFile: 30 * 1024 * 1024,
  maxFiles: 20,
  async run({ tool, files }) {
    const outputs: OutputFile[] = [];
    const used = new Set<string>();
    for (const file of files) {
      let text: string;
      try {
        if (tool.output === "txt") {
          const res = await mammoth.extractRawText({ buffer: file.data });
          text = res.value.replace(/\r\n/g, "\n");
          if (!text.trim()) {
            throw new ConvertError("conversion_failed", `"${file.name}" contains no readable text.`);
          }
        } else if (tool.output === "html") {
          const res = await mammoth.convertToHtml({ buffer: file.data });
          text =
            `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
            `<title>${baseName(file.name)}</title>\n</head>\n<body>\n${res.value}\n</body>\n</html>\n`;
        } else {
          const res = await mammoth.convertToHtml({ buffer: file.data });
          const htmlWithoutImages = res.value.replace(/<img[^>]*>/gi, "");
          const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
          text = td.turndown(htmlWithoutImages).trimEnd() + "\n";
        }
      } catch (e) {
        if (e instanceof ConvertError) throw e;
        throw toConvertError(e, `"${file.name}" is not a valid Word (.docx) document, or it is damaged.`);
      }
      let name = `${baseName(file.name)}.${tool.output}`;
      if (used.has(name.toLowerCase())) name = `${baseName(file.name)}-${used.size + 1}.${tool.output}`;
      used.add(name.toLowerCase());
      outputs.push({ name, mime: tool.outputMime, data: Buffer.from(text, "utf8") });
    }
    return outputs;
  },
};

const MD_HEADING = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
} as const;

function markdownToParagraphs(md: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: raw, font: "Courier New" })] }));
      continue;
    }
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      const level = heading[1]!.length;
      paragraphs.push(
        new Paragraph({ text: heading[2] ?? "", heading: MD_HEADING[level as keyof typeof MD_HEADING] ?? HeadingLevel.HEADING_4 }),
      );
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun(bullet[1] ?? "")], bullet: { level: 0 } }),
      );
      continue;
    }
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      paragraphs.push(
        new Paragraph({ children: [new TextRun(numbered[1] ?? "")], numbering: { reference: "nexora-num", level: 0 } }),
      );
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: quote[1] ?? "", italics: true })] }));
      continue;
    }
    paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  return paragraphs;
}

/** TXT / Markdown → DOCX. */
const textToDocx: ConversionHandler = {
  id: "text-to-docx",
  maxBytesPerFile: 20 * 1024 * 1024,
  maxFiles: 20,
  async run({ tool, files }) {
    const outputs: OutputFile[] = [];
    const used = new Set<string>();
    for (const file of files) {
      const raw = file.data.toString("utf8");
      if (!raw.trim()) {
        throw new ConvertError("invalid_file", `"${file.name}" is empty.`);
      }
      let children: Paragraph[];
      if (tool.id === "md-to-docx") {
        children = markdownToParagraphs(raw);
        if (children.length === 0) {
          throw new ConvertError("conversion_failed", `"${file.name}" contains no content.`);
        }
      } else {
        const lines = raw.replace(/\r\n/g, "\n").split("\n");
        while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
        children = lines.map((line) => new Paragraph({ children: [new TextRun(line)] }));
      }
      const doc = new Document({
        numbering: {
          config: [
            {
              reference: "nexora-num",
              levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "start" }],
            },
          ],
        },
        sections: [{ children }],
      });
      let bytes: Buffer;
      try {
        bytes = Buffer.from(await Packer.toBuffer(doc));
      } catch {
        throw new ConvertError("conversion_failed", `"${file.name}" could not be converted.`);
      }
      let name = `${baseName(file.name)}.docx`;
      if (used.has(name.toLowerCase())) name = `${baseName(file.name)}-${used.size + 1}.docx`;
      used.add(name.toLowerCase());
      outputs.push({ name, mime: tool.outputMime, data: bytes });
    }
    return outputs;
  },
};

export const documentHandlers: ConversionHandler[] = [docxConvert, textToDocx];
