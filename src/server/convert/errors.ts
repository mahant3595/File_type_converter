export type ConvertErrorCode =
  | "unknown_tool"
  | "unsupported_handler"
  | "invalid_request"
  | "invalid_file"
  | "too_large"
  | "too_many_files"
  | "corrupt_file"
  | "conversion_failed"
  | "timeout"
  | "internal";

const STATUS: Record<ConvertErrorCode, number> = {
  unknown_tool: 404,
  unsupported_handler: 422,
  invalid_request: 400,
  invalid_file: 422,
  too_large: 413,
  too_many_files: 413,
  corrupt_file: 422,
  conversion_failed: 422,
  timeout: 504,
  internal: 500,
};

/** Safe, user-facing conversion error. Messages must never leak internals. */
export class ConvertError extends Error {
  readonly code: ConvertErrorCode;
  readonly status: number;

  constructor(code: ConvertErrorCode, message: string) {
    super(message);
    this.name = "ConvertError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function isConvertError(e: unknown): e is ConvertError {
  return e instanceof ConvertError;
}

/** Map raw engine failures onto honest, actionable messages. */
export function toConvertError(e: unknown, fallback = "The conversion failed. The file may be corrupted or use an unsupported codec."): ConvertError {
  if (isConvertError(e)) return e;
  const msg = e instanceof Error ? e.message : "";
  if (/unsupported image format|Input buffer contains unsupported/i.test(msg)) {
    return new ConvertError("invalid_file", "This file is not a supported image, or it is corrupted.");
  }
  if (/Invalid PDF|PDF header|not a PDF|acrobat/i.test(msg)) {
    return new ConvertError("corrupt_file", "This PDF could not be opened. It may be password-protected or damaged.");
  }
  if (/password|encrypted/i.test(msg)) {
    return new ConvertError("corrupt_file", "This file is password-protected. Remove the password and try again.");
  }
  return new ConvertError("conversion_failed", fallback);
}
