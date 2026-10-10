import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import type { ConversionHandler, OutputFile } from "../types";
import { ConvertError, toConvertError } from "../errors";
import { resolveOptions } from "@/lib/catalog";
import { stripExtension } from "@/lib/validate";

const A4: [number, number] = [595.28, 841.89];

/** JPG/PNG → PDF; each input file becomes one page, in order. */
async function run({ tool, files, options }: Parameters<ConversionHandler["run"]>[0]): Promise<OutputFile[]> {
  const opts = resolveOptions(tool, options);
  const pageSize = opts.pageSize === "a4" ? "a4" : "fit";

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.create();
  } catch (e) {
    throw toConvertError(e, "Could not create the PDF document.");
  }

  for (const file of files) {
    try {
      const meta = await sharp(file.data).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) {
        throw new ConvertError("invalid_file", `"${file.name}" has no readable image dimensions.`);
      }
      const isJpg = /\.(jpe?g)$/i.test(file.name);
      const embedded = isJpg ? await doc.embedJpg(file.data) : await doc.embedPng(file.data);

      if (pageSize === "a4") {
        const [pw, ph] = A4;
        const margin = 36;
        const scale = Math.min((pw - margin * 2) / width, (ph - margin * 2) / height);
        const w = width * scale;
        const h = height * scale;
        const page = doc.addPage([pw, ph]);
        page.drawImage(embedded, {
          x: (pw - w) / 2,
          y: (ph - h) / 2,
          width: w,
          height: h,
        });
      } else {
        const page = doc.addPage([width, height]);
        page.drawImage(embedded, { x: 0, y: 0, width, height });
      }
    } catch (e) {
      throw toConvertError(e, `"${file.name}" could not be embedded. Use a valid JPG or PNG image.`);
    }
  }

  if (doc.getPageCount() === 0) {
    throw new ConvertError("invalid_file", "No images were provided.");
  }
  const bytes = await doc.save();
  const base = stripExtension(files[0]!.name);
  return [{ name: `${base}.pdf`, mime: tool.outputMime, data: Buffer.from(bytes) }];
}

export const imageToPdfHandler: ConversionHandler = {
  id: "image-to-pdf",
  maxBytesPerFile: 50 * 1024 * 1024,
  maxFiles: 30,
  maxOutputs: 1,
  run,
};
