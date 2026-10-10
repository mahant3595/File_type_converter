import sharp from "sharp";
import type { ConversionHandler, OutputFile } from "../types";
import { ConvertError, toConvertError } from "../errors";
import { resolveOptions } from "@/lib/catalog";
import { extensionOf, stripExtension } from "@/lib/validate";

/**
 * Raster/vector image conversion via sharp (libvips).
 * Supports JPG/PNG/WEBP/GIF/TIFF/AVIF/SVG inputs and JPG/PNG/WEBP outputs.
 */
async function run({ tool, files, options }: Parameters<ConversionHandler["run"]>[0]): Promise<OutputFile[]> {
  const opts = resolveOptions(tool, options);
  const quality = Number(opts.quality ?? 90);
  const maxWidth = Number(opts.maxWidth ?? 0);
  const scale = Number(opts.scale ?? 1);
  const outputExt = tool.output;
  const animatedOut = tool.id === "gif-to-webp";
  const isSvg = tool.inputs.includes("svg");
  const used = new Set<string>();

  const outputs: OutputFile[] = [];
  for (const file of files) {
    const inputExt = extensionOf(file.name);
    try {
      const sharpInstance = sharp(file.data, {
        animated: animatedOut,
        ...(isSvg && scale !== 1 ? { density: Math.min(600, 72 * scale) } : {}),
        limitInputPixels: 268402689, // ~16k×16k safety cap
      });

      if (maxWidth > 0 && !isSvg) {
        sharpInstance.resize({ width: maxWidth, withoutEnlargement: true });
      }

      let buf: Buffer;
      if (outputExt === "png") {
        buf = await sharpInstance.png({ compressionLevel: 9, palette: false }).toBuffer();
      } else if (outputExt === "webp") {
        buf = await sharpInstance.webp({ quality, effort: 4 }).toBuffer();
      } else {
        buf = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
      }

      let name = `${stripExtension(file.name)}.${outputExt}`;
      if (used.has(name.toLowerCase())) {
        name = `${stripExtension(file.name)}-${used.size + 1}.${outputExt}`;
      }
      used.add(name.toLowerCase());
      outputs.push({ name, mime: tool.outputMime, data: buf });
    } catch (e) {
      throw toConvertError(
        e,
        `"${file.name}" could not be converted. It may be corrupted or not a real ${inputExt.toUpperCase()} image.`,
      );
    }
  }
  if (outputs.length === 0) {
    throw new ConvertError("invalid_file", "No convertible image was provided.");
  }
  return outputs;
}

export const imageHandler: ConversionHandler = {
  id: "image",
  maxBytesPerFile: 50 * 1024 * 1024,
  maxFiles: 20,
  maxOutputs: 20,
  run,
};
