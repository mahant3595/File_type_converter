import { getTool, type ToolDef } from "@/lib/catalog";
import { getHandlerForTool } from "@/server/convert/registry";
import { isConvertError, type ConvertErrorCode } from "@/server/convert/errors";
import type { OutputFile } from "@/server/convert/types";

export interface NamedFile {
  name: string;
  data: Buffer;
}

export async function runTool(
  toolId: string,
  files: NamedFile[],
  options: Record<string, string | number> = {},
): Promise<OutputFile[]> {
  const tool: ToolDef | undefined = getTool(toolId);
  if (!tool) throw new Error(`unknown tool ${toolId}`);
  const handler = getHandlerForTool(tool);
  return handler.run({ tool, files, options });
}

export async function expectConvertError(
  promise: Promise<unknown>,
  ...codes: ConvertErrorCode[]
): Promise<Error> {
  try {
    await promise;
  } catch (e) {
    if (!isConvertError(e)) throw e;
    if (codes.length > 0 && !codes.includes(e.code)) {
      throw new Error(`expected codes ${codes.join("/")} but got ${e.code}: ${e.message}`);
    }
    return e;
  }
  throw new Error(`expected conversion to fail with ${codes.join("/") || "an error"}`);
}
