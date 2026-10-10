import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { getTool, resolveOptions } from "@/lib/catalog";
import { isExtensionAllowed, sanitizeFilename } from "@/lib/validate";
import { limitsFor, TOTAL_UPLOAD_LIMIT } from "@/lib/limits";
import { getHandlerForTool } from "@/server/convert/registry";
import { ConvertError, isConvertError, toConvertError } from "@/server/convert/errors";
import type { InputFile, OutputFile } from "@/server/convert/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Absolute request ceiling (base64 inflates payloads ~33%). */
const MAX_REQUEST_BYTES = 700 * 1024 * 1024;
const CONVERSION_TIMEOUT_MS = 8.5 * 60 * 1000;

function errorResponse(err: ConvertError): NextResponse {
  return NextResponse.json(
    { error: { code: err.code, message: err.message } },
    { status: err.status, headers: { "cache-control": "no-store" } },
  );
}

/** Content-sniffing compatibility: detected magic ext vs allowed extensions. */
const SNIFF_GROUPS: string[][] = [
  ["jpg", "jpeg"],
  ["tif", "tiff"],
  ["zip", "xlsx", "docx", "pptx", "ods"],
  // MP4-family containers: .m4a audio commonly sniffs as mp4/m4v/m4b depending on the brand.
  ["mp4", "mov", "m4a", "m4v", "m4b"],
  // Ogg audio: Opus (and OGA) files are valid inputs for .ogg tools.
  ["ogg", "oga", "opus"],
  // Legacy .xls is an OLE2 compound file, which sniffs as "cfb".
  ["xls", "cfb"],
  ["svg", "xml", "html"],
];

function sniffCompatible(detected: string, allowed: string[]): boolean {
  if (allowed.includes("*")) return true;
  if (allowed.includes(detected)) return true;
  const group = SNIFF_GROUPS.find((g) => g.includes(detected));
  if (group && allowed.some((a) => group.includes(a))) return true;
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ConvertError("timeout", message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_REQUEST_BYTES) {
      return errorResponse(
        new ConvertError("too_large", "The request is too large. Please convert fewer or smaller files."),
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorResponse(new ConvertError("invalid_request", "The request must be sent as multipart/form-data."));
    }

    const toolId = String(form.get("tool") ?? "");
    const tool = getTool(toolId);
    if (!tool) {
      return errorResponse(new ConvertError("unknown_tool", "This conversion tool does not exist."));
    }

    const handler = getHandlerForTool(tool);
    const limits = limitsFor(tool);

    // Options (catalog defaults + whitelist of declared settings).
    let rawOptions: Record<string, unknown> = {};
    const optionsField = form.get("options");
    if (typeof optionsField === "string" && optionsField.trim()) {
      try {
        const parsed = JSON.parse(optionsField) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          rawOptions = parsed as Record<string, unknown>;
        }
      } catch {
        return errorResponse(new ConvertError("invalid_request", "The conversion options are invalid."));
      }
    }
    const declaredKeys = new Set((tool.settings ?? []).map((s) => s.key));
    for (const key of Object.keys(rawOptions)) {
      if (!declaredKeys.has(key)) delete rawOptions[key];
    }
    const options = resolveOptions(tool, rawOptions);

    // Collect files.
    const rawFiles = form.getAll("files");
    const files: InputFile[] = [];
    let totalBytes = 0;

    for (const entry of rawFiles) {
      if (!(entry instanceof File)) {
        return errorResponse(new ConvertError("invalid_request", "Each file must be uploaded as a form file."));
      }
      if (files.length >= limits.maxFiles) {
        return errorResponse(
          new ConvertError(
            "too_many_files",
            `"${tool.name}" accepts up to ${limits.maxFiles} file${limits.maxFiles === 1 ? "" : "s"} at a time.`,
          ),
        );
      }
      const name = sanitizeFilename(entry.name, "upload");
      if (!isExtensionAllowed(name, tool.inputs)) {
        const accepts = tool.inputs.includes("*") ? "any file type" : tool.inputs.map((e) => e.toUpperCase()).join(", ");
        return errorResponse(
          new ConvertError("invalid_file", `"${name}" is not supported here. This tool accepts ${accepts}.`),
        );
      }
      if (entry.size > limits.maxBytesPerFile) {
        return errorResponse(
          new ConvertError(
            "too_large",
            `"${name}" is larger than the ${Math.round(limits.maxBytesPerFile / (1024 * 1024))} MB limit for this tool.`,
          ),
        );
      }
      const data = Buffer.from(await entry.arrayBuffer());
      if (data.length === 0) {
        return errorResponse(new ConvertError("invalid_file", `"${name}" is empty.`));
      }
      totalBytes += data.length;
      if (totalBytes > TOTAL_UPLOAD_LIMIT) {
        return errorResponse(
          new ConvertError("too_large", "The total upload size exceeds the 500 MB limit per conversion."),
        );
      }

      // Magic-byte inspection (never trust the extension alone).
      if (!tool.inputs.includes("*")) {
        try {
          const sniffed = await fileTypeFromBuffer(data);
          if (sniffed?.ext && !sniffCompatible(sniffed.ext, tool.inputs)) {
            return errorResponse(
              new ConvertError(
                "invalid_file",
                `"${name}" contains ${sniffed.ext.toUpperCase()} data, but this tool accepts ${tool.inputs.map((e) => e.toUpperCase()).join(", ")}. Rename it correctly or pick the right tool.`,
              ),
            );
          }
        } catch {
          /* sniffing is best-effort; text formats have no signature */
        }
      }

      files.push({ name, data });
    }

    if (files.length === 0) {
      return errorResponse(new ConvertError("invalid_request", "Choose at least one file to convert."));
    }
    if (tool.multiInput && !tool.batch && files.length < 2 && tool.id === "merge-pdf") {
      return errorResponse(new ConvertError("invalid_file", "Select at least two PDF files to merge."));
    }

    const outputs: OutputFile[] = await withTimeout(
      handler.run({ tool, files, options }),
      CONVERSION_TIMEOUT_MS,
      "The conversion took too long and was stopped. Try a smaller file.",
    );

    if (!Array.isArray(outputs) || outputs.length === 0) {
      throw new ConvertError("conversion_failed", "The conversion produced no output.");
    }
    let outTotal = 0;
    const payload = outputs.map((out) => {
      outTotal += out.data.length;
      if (outTotal > TOTAL_UPLOAD_LIMIT * 2) {
        throw new ConvertError("conversion_failed", "The converted output is too large to download in one step.");
      }
      return {
        name: sanitizeFilename(out.name, "converted"),
        mime: out.mime || "application/octet-stream",
        size: out.data.length,
        data: out.data.toString("base64"),
      };
    });

    return NextResponse.json(
      { outputs: payload },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    if (isConvertError(e)) return errorResponse(e);
    const err = toConvertError(e);
    // Log server-side for operators, but never return internal details.
    console.error("[convert] unhandled error:", e instanceof Error ? e.message : e);
    return errorResponse(err);
  }
}

export function GET(): NextResponse {
  return errorResponse(
    new ConvertError("invalid_request", "Use POST to convert files."),
  );
}
