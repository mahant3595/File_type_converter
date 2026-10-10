/**
 * Upload/processing limits shared by client validation and the server.
 * The test suite asserts these match the limits enforced by each handler.
 */
import type { ToolDef } from "./catalog";

export interface HandlerLimit {
  maxBytesPerFile: number;
  maxFiles: number;
}

const MB = 1024 * 1024;

export const HANDLER_LIMITS: Record<string, HandlerLimit> = {
  image: { maxBytesPerFile: 50 * MB, maxFiles: 20 },
  "image-to-pdf": { maxBytesPerFile: 50 * MB, maxFiles: 30 },
  "pdf-render": { maxBytesPerFile: 100 * MB, maxFiles: 1 },
  "pdf-text": { maxBytesPerFile: 100 * MB, maxFiles: 1 },
  "pdf-to-docx": { maxBytesPerFile: 100 * MB, maxFiles: 1 },
  "pdf-merge": { maxBytesPerFile: 100 * MB, maxFiles: 30 },
  "pdf-split": { maxBytesPerFile: 100 * MB, maxFiles: 1 },
  "docx-convert": { maxBytesPerFile: 30 * MB, maxFiles: 20 },
  "text-to-docx": { maxBytesPerFile: 20 * MB, maxFiles: 20 },
  "sheet-convert": { maxBytesPerFile: 30 * MB, maxFiles: 20 },
  "pptx-convert": { maxBytesPerFile: 50 * MB, maxFiles: 10 },
  av: { maxBytesPerFile: 250 * MB, maxFiles: 10 },
  "archive-create": { maxBytesPerFile: 250 * MB, maxFiles: 100 },
  "archive-convert": { maxBytesPerFile: 250 * MB, maxFiles: 10 },
  "archive-extract": { maxBytesPerFile: 250 * MB, maxFiles: 1 },
};

export const TOTAL_UPLOAD_LIMIT = 500 * MB;

export interface ToolLimits {
  maxBytesPerFile: number;
  maxFiles: number;
}

export function limitsFor(tool: ToolDef): ToolLimits {
  const handler = HANDLER_LIMITS[tool.handler] ?? { maxBytesPerFile: 25 * MB, maxFiles: 10 };
  const maxFiles = Math.min(handler.maxFiles, tool.maxFiles ?? handler.maxFiles);
  return { maxBytesPerFile: handler.maxBytesPerFile, maxFiles: Math.max(1, maxFiles) };
}
