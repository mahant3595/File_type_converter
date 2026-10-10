"use client";

import * as React from "react";
import { FileUp, X } from "lucide-react";
import type { ToolDef } from "@/lib/catalog";
import { familyOf, type FormatFamily } from "@/lib/catalog";
import { formatBytes, sanitizeFilename } from "@/lib/validate";
import type { ToolLimits } from "@/lib/limits";
import { FormatFamilyIcon } from "../icons";

export interface SelectedFile {
  /** Unique local id (never sent to the server — the File object is). */
  key: string;
  file: File;
  name: string;
  ext: string;
}

export function buildAccept(tool: ToolDef): string | undefined {
  if (tool.inputs.includes("*")) return undefined;
  return tool.inputs.map((e) => `.${e}`).join(",");
}

export function describeAccept(tool: ToolDef, limits: ToolLimits): string {
  const types = tool.inputs.includes("*")
    ? "any file type"
    : tool.inputs.map((e) => e.toUpperCase()).join(", ");
  const files = limits.maxFiles === 1 ? "1 file" : `up to ${limits.maxFiles} files`;
  return `Accepts ${types} · max ${formatBytes(limits.maxBytesPerFile)} per file · ${files}`;
}

export function useFileSelection(tool: ToolDef, limits: ToolLimits) {
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);

  const addFiles = React.useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const rejected: string[] = [];
      setFiles((prev) => {
        const next = [...prev];
        for (const raw of list) {
          const name = sanitizeFilename(raw.name, "upload");
          if (next.length >= limits.maxFiles) {
            rejected.push(`Only ${limits.maxFiles} file${limits.maxFiles === 1 ? "" : "s"} can be converted at once — extra files were skipped.`);
            continue;
          }
          const ext = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
          if (!tool.inputs.includes("*") && !tool.inputs.includes(ext)) {
            rejected.push(`“${name}” is not supported. This tool accepts ${tool.inputs.map((e) => e.toUpperCase()).join(", ")}.`);
            continue;
          }
          if (raw.size > limits.maxBytesPerFile) {
            rejected.push(`“${name}” is ${formatBytes(raw.size)} — the limit is ${formatBytes(limits.maxBytesPerFile)} per file.`);
            continue;
          }
          if (raw.size === 0) {
            rejected.push(`“${name}” is empty.`);
            continue;
          }
          if (next.some((f) => f.name === name && f.file.size === raw.size)) {
            rejected.push(`“${name}” is already in the list.`);
            continue;
          }
          const total = next.reduce((sum, f) => sum + f.file.size, 0);
          if (total + raw.size > 500 * 1024 * 1024) {
            rejected.push(`Total upload size would exceed 500 MB.`);
            continue;
          }
          next.push({
            key: `${name}:${raw.size}:${raw.lastModified}:${Math.random().toString(36).slice(2, 8)}`,
            file: new File([raw], name, { type: raw.type, lastModified: raw.lastModified }),
            name,
            ext,
          });
        }
        return next;
      });
      setErrors(rejected);
    },
    [limits.maxBytesPerFile, limits.maxFiles, tool.inputs],
  );

  const removeFile = React.useCallback((key: string) => {
    setFiles((prev) => prev.filter((f) => f.key !== key));
    setErrors([]);
  }, []);

  const clearFiles = React.useCallback(() => {
    setFiles([]);
    setErrors([]);
  }, []);

  return { files, errors, setErrors, addFiles, removeFile, clearFiles, setFiles };
}

export function Dropzone({
  tool,
  limits,
  disabled = false,
  compact = false,
  onFiles,
  id = "file-input",
}: {
  tool: ToolDef;
  limits: ToolLimits;
  disabled?: boolean;
  compact?: boolean;
  onFiles: (files: File[]) => void;
  id?: string;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer?.files;
    if (dropped && dropped.length > 0) onFiles(Array.from(dropped));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex ${compact ? "flex-row items-center gap-4 px-4 py-4" : "flex-col items-center px-5 py-10 text-center"} rounded-card border border-dashed transition-colors duration-150 ${
          dragging
            ? "border-accent bg-accent/10"
            : "border-border-strong bg-card hover:border-accent/50"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <span
          className={`inline-flex ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 items-center justify-center rounded-control border border-border bg-elevated text-accent-soft`}
          aria-hidden="true"
        >
          <FileUp className={compact ? "h-5 w-5" : "h-6 w-6"} />
        </span>
        <div className={compact ? "min-w-0 flex-1 text-left" : ""}>
          <p className={`${compact ? "text-sm" : "text-base"} font-medium text-foreground`}>
            Drag &amp; drop {tool.inputs.includes("*") ? "files" : `${tool.inputs[0]?.toUpperCase()} files`} here
          </p>
          <p className="mt-1 text-sm text-muted">
            or{" "}
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="font-medium text-accent-soft underline-offset-4 hover:underline"
            >
              browse your device
            </button>
          </p>
          {!compact ? (
            <p className="mt-2 text-xs text-faint">{describeAccept(tool, limits)}</p>
          ) : null}
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple={limits.maxFiles > 1}
          accept={buildAccept(tool)}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
      {!compact ? (
        <p className="mt-2 text-xs text-faint" aria-hidden="true">
          {describeAccept(tool, limits)}
        </p>
      ) : null}
    </div>
  );
}

export function FileList({
  files,
  onRemove,
  disabled = false,
  statuses,
}: {
  files: SelectedFile[];
  onRemove: (key: string) => void;
  disabled?: boolean;
  statuses?: Record<string, "ready" | "sending" | "converting" | "done" | "failed">;
}) {
  if (files.length === 0) return null;
  const total = files.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-xs text-faint">
        <span>
          {files.length} file{files.length === 1 ? "" : "s"} selected
        </span>
        <span>{formatBytes(total)} total</span>
      </div>
      <ul className="space-y-2">
        {files.map((f) => {
          const status = statuses?.[f.key];
          const family: FormatFamily = familyOf(f.ext);
          return (
            <li
              key={f.key}
              className="flex items-center gap-3 rounded-control border border-border bg-card px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-elevated text-muted">
                <FormatFamilyIcon family={family} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{f.name}</span>
                <span className="block text-xs text-faint">
                  {f.ext.toUpperCase()} · {formatBytes(f.file.size)}
                </span>
              </span>
              {status && status !== "ready" ? (
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    status === "done"
                      ? "border-success/40 bg-success/10 text-success"
                      : status === "failed"
                        ? "border-error/40 bg-error/10 text-error"
                        : "border-accent/40 bg-accent/10 text-accent-soft"
                  }`}
                >
                  {status === "sending" ? "Uploading" : status === "converting" ? "Converting" : status === "done" ? "Done" : "Failed"}
                </span>
              ) : null}
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => onRemove(f.key)}
                  aria-label={`Remove ${f.name}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-elevated hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
