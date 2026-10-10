import type { ToolDef } from "@/lib/catalog";

export interface InputFile {
  /** Original (already sanitized) filename. */
  name: string;
  data: Buffer;
}

export interface OutputFile {
  name: string;
  mime: string;
  data: Buffer;
}

export interface HandlerRunArgs {
  tool: ToolDef;
  files: InputFile[];
  options: Record<string, string | number>;
}

export interface ConversionHandler {
  id: string;
  /** Server-enforced per-file byte limit. */
  maxBytesPerFile: number;
  /** Server-enforced input count limit (tools may lower it further). */
  maxFiles: number;
  /** Upper bound on produced outputs (protects memory). */
  maxOutputs?: number;
  run(args: HandlerRunArgs): Promise<OutputFile[]>;
}
