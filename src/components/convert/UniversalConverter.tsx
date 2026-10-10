"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, RefreshCw } from "lucide-react";
import type { ToolDef } from "@/lib/catalog";
import { familyOf } from "@/lib/catalog";
import { extensionOf, formatBytes, sanitizeFilename } from "@/lib/validate";
import { setPendingFiles } from "@/lib/pending-files";
import { FormatFamilyIcon } from "../icons";
import { FormatBadge } from "../ui/Badge";
import { Button } from "../ui/Button";

/**
 * Universal converter: drop a file, we detect its format and show only the
 * tools that genuinely accept it. The file is handed to the chosen tool page
 * in memory (this tab only) so the user doesn't upload twice.
 */
export function UniversalConverter({ tools }: { tools: ToolDef[] }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const ext = file ? extensionOf(file.name) : "";
  const specific = file ? tools.filter((t) => !t.inputs.includes("*") && t.inputs.includes(ext)) : [];
  const universal = file ? tools.filter((t) => t.inputs.includes("*")) : [];

  function accept(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    setFile(new File([picked], sanitizeFilename(picked.name, "upload"), { type: picked.type }));
  }

  function choose(tool: ToolDef) {
    if (!file) return;
    setPendingFiles([file]);
    router.push(`/convert/${tool.id}`);
  }

  if (!file) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer?.files ?? null);
        }}
        className={`flex flex-col items-center rounded-card border border-dashed px-6 py-14 text-center transition-colors duration-150 ${
          dragging ? "border-accent bg-accent/10" : "border-border-strong bg-card"
        }`}
      >
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-panel border border-border bg-elevated text-accent-soft">
          <FileUp className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Drop a file to get started</h2>
        <p className="mt-1.5 max-w-md text-sm text-muted">
          We will detect the format and show every conversion that actually works for it — nothing else.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => inputRef.current?.click()}>
            Browse your device
          </Button>
          <Link
            href="/tools"
            className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-border bg-elevated px-6 text-base text-foreground transition-colors hover:border-border-strong"
          >
            Browse all tools
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Choose a file to convert"
          onChange={(e) => accept(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4 rounded-control border border-border bg-card px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-elevated text-muted">
          <FormatFamilyIcon family={familyOf(ext)} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
          <span className="block text-xs text-faint">
            Detected {ext ? ext.toUpperCase() : "file"} · {formatBytes(file.size)}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setFile(null)}
          className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-elevated px-3.5 text-sm text-foreground transition-colors hover:border-border-strong"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Choose another
        </button>
      </div>

      {specific.length > 0 ? (
        <section className="mt-5" aria-labelledby="matching-tools">
          <h2 id="matching-tools" className="mb-3 text-sm font-semibold uppercase tracking-wider text-faint">
            Convert {ext.toUpperCase()} to…
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {specific.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => choose(tool)}
                  className="group flex w-full items-center gap-3 rounded-panel border border-border bg-card px-4 py-3.5 text-left transition-colors duration-150 hover:border-accent/50 hover:bg-elevated/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{tool.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{tool.description}</span>
                  </span>
                  <FormatBadge from={ext} to={tool.output} />
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-faint transition-all group-hover:translate-x-0.5 group-hover:text-accent-soft"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="mt-5 rounded-control border border-warning/40 bg-warning/10 p-4" role="status">
          <p className="text-sm font-medium text-warning">
            We cannot convert {ext ? ext.toUpperCase() : "this file type"} yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Only tested conversions are offered here, so there is nothing to suggest for this format. You can still
            bundle it into an archive below, or browse everything we support.
          </p>
          <Link
            href="/tools"
            className="mt-2.5 inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-3.5 text-sm text-foreground transition-colors hover:border-accent/50"
          >
            Browse all tools
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {universal.length > 0 ? (
        <section className="mt-5" aria-labelledby="universal-tools">
          <h2 id="universal-tools" className="mb-3 text-sm font-semibold uppercase tracking-wider text-faint">
            Or bundle it
          </h2>
          <ul className="flex flex-wrap gap-2">
            {universal.map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => choose(tool)}
                  className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-card px-3.5 text-sm text-foreground transition-colors hover:border-accent/50 hover:bg-elevated"
                >
                  {tool.name}
                  <ArrowRight className="h-3.5 w-3.5 text-accent-soft" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
