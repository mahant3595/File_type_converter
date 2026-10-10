import AdmZip from "adm-zip";
import type { ConversionHandler } from "../types";
import { ConvertError } from "../errors";
import { stripExtension } from "@/lib/validate";

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Extract readable text from PPTX slide XML (ordered, paragraph-aware). */
function slideText(xml: string): string {
  const paragraphs: string[] = [];
  const paraParts = xml.split(/<a:p[\s>]/).slice(1);
  for (const part of paraParts) {
    const runs: string[] = [];
    const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) runs.push(m[1] ?? "");
    const text = decodeXmlEntities(runs.join("")).replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs.join("\n");
}

/** PPTX → TXT: the text of every slide. */
const pptxConvert: ConversionHandler = {
  id: "pptx-convert",
  maxBytesPerFile: 50 * 1024 * 1024,
  maxFiles: 10,
  async run({ tool, files }) {
    const outputs = [];
    const used = new Set<string>();
    for (const file of files) {
      let zip: AdmZip;
      try {
        zip = new AdmZip(file.data);
      } catch {
        throw new ConvertError("invalid_file", `"${file.name}" is not a valid ZIP-based PowerPoint (.pptx) file.`);
      }
      const slides = zip
        .getEntries()
        .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
        .sort(
          (a, b) =>
            Number(/slide(\d+)\.xml/i.exec(a.entryName)?.[1] ?? 0) -
            Number(/slide(\d+)\.xml/i.exec(b.entryName)?.[1] ?? 0),
        );
      if (slides.length === 0) {
        throw new ConvertError("invalid_file", `"${file.name}" contains no slides. Legacy .ppt files are not supported.`);
      }
      const parts: string[] = [];
      slides.forEach((entry, i) => {
        const xml = entry.getData().toString("utf8");
        const text = slideText(xml);
        parts.push(`Slide ${i + 1}\n${"=".repeat(7)}\n${text || "(no text)"}`);
      });
      const body = parts.join("\n\n") + "\n";
      let name = `${stripExtension(file.name)}.txt`;
      if (used.has(name.toLowerCase())) name = `${stripExtension(file.name)}-${used.size + 1}.txt`;
      used.add(name.toLowerCase());
      outputs.push({ name, mime: tool.outputMime, data: Buffer.from(body, "utf8") });
    }
    if (outputs.length === 0) throw new ConvertError("invalid_file", "No presentation files were provided.");
    return outputs;
  },
};

export const presentationHandlers: ConversionHandler[] = [pptxConvert];
