/**
 * Tiny in-memory hand-off from the universal converter (/convert) to a chosen
 * tool page. Lives only in this tab's memory — never persisted anywhere.
 */
let pending: File[] = [];

export function setPendingFiles(files: File[]): void {
  pending = files;
}

export function takePendingFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
