/**
 * Conversion registry: binds the tool catalog to real handler implementations
 * and gates availability on runtime capabilities.
 *
 * Rule: the UI may only render tools whose handler is registered AND whose
 * capabilities are present on this machine.
 */
import { TOOLS, type ToolDef } from "@/lib/catalog";
import { ConvertError } from "./errors";
import { getCapabilities } from "./capabilities";
import type { ConversionHandler } from "./types";
import { imageHandler } from "./handlers/image";
import { imageToPdfHandler } from "./handlers/image-to-pdf";
import { pdfHandlers } from "./handlers/pdf";
import { documentHandlers } from "./handlers/document";
import { sheetHandlers } from "./handlers/sheet";
import { presentationHandlers } from "./handlers/presentation";
import { avHandlers } from "./handlers/av";
import { archiveHandlers } from "./handlers/archive";

const HANDLERS: ConversionHandler[] = [
  imageHandler,
  imageToPdfHandler,
  ...pdfHandlers,
  ...documentHandlers,
  ...sheetHandlers,
  ...presentationHandlers,
  ...avHandlers,
  ...archiveHandlers,
];

export const HANDLER_MAP: ReadonlyMap<string, ConversionHandler> = new Map(
  HANDLERS.map((h) => [h.id, h]),
);

/** Handler ids that need optional runtime capabilities. */
const CAPABILITY_REQUIREMENTS: Record<string, keyof ReturnType<typeof capabilityMap>> = {
  av: "ffmpeg",
};

function capabilityMap(caps: { ffmpeg: boolean }) {
  return { ffmpeg: caps.ffmpeg };
}

export function getHandlerForTool(tool: ToolDef): ConversionHandler {
  const handler = HANDLER_MAP.get(tool.handler);
  if (!handler) {
    throw new ConvertError(
      "unsupported_handler",
      `No conversion engine is registered for "${tool.name}".`,
    );
  }
  return handler;
}

export async function isToolAvailable(tool: ToolDef): Promise<boolean> {
  if (!HANDLER_MAP.has(tool.handler)) return false;
  const required = CAPABILITY_REQUIREMENTS[tool.handler];
  if (!required) return true;
  const caps = await getCapabilities();
  return Boolean(capabilityMap(caps)[required]);
}

/** Only genuinely available tools — this list feeds the entire UI. */
export async function getAvailableTools(): Promise<ToolDef[]> {
  const out: ToolDef[] = [];
  for (const tool of TOOLS) {
    if (await isToolAvailable(tool)) out.push(tool);
  }
  return out;
}

/** Integrity report used by tests: catalog ↔ registry consistency. */
export function registryIssues(): string[] {
  const issues: string[] = [];
  for (const tool of TOOLS) {
    if (!HANDLER_MAP.has(tool.handler)) {
      issues.push(`tool "${tool.id}" references missing handler "${tool.handler}"`);
    }
    if (tool.inputs.length === 0) issues.push(`tool "${tool.id}" declares no inputs`);
    if (!tool.output) issues.push(`tool "${tool.id}" declares no output`);
    if (tool.batch && tool.multiInput) {
      issues.push(`tool "${tool.id}" is both batch and multi-input (ambiguous)`);
    }
  }
  for (const handler of HANDLERS) {
    if (!TOOLS.some((t) => t.handler === handler.id)) {
      issues.push(`handler "${handler.id}" is not referenced by any tool`);
    }
  }
  return issues;
}
