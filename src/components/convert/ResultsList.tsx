"use client";

import * as React from "react";
import { Download, FileCheck2, PackageCheck } from "lucide-react";
import { formatBytes } from "@/lib/validate";
import { triggerDownload } from "@/lib/client-upload";

export interface ResultItem {
  name: string;
  mime: string;
  size: number;
  blob: Blob;
}

export function ResultsList({ items }: { items: ResultItem[] }) {
  const [zipping, setZipping] = React.useState(false);

  async function downloadAll() {
    setZipping(true);
    try {
      const { downloadZip } = await import("client-zip");
      const blob = await downloadZip(
        items.map((item) => ({ name: item.name, input: item.blob })),
      ).blob();
      triggerDownload(blob, "nexora-converted.zip");
    } finally {
      setZipping(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {items.length === 1 ? "1 file ready" : `${items.length} files ready`}
        </p>
        {items.length > 1 ? (
          <button
            type="button"
            onClick={downloadAll}
            disabled={zipping}
            className="inline-flex h-9 items-center gap-2 rounded-control border border-transparent bg-accent px-4 text-sm font-semibold text-background transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            {zipping ? "Preparing…" : "Download All"}
          </button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-3 rounded-control border border-border bg-card px-3 py-2.5 sm:px-4"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-success/40 bg-success/10 text-success">
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
              <span className="block text-xs text-faint">{formatBytes(item.size)}</span>
            </span>
            <button
              type="button"
              onClick={() => triggerDownload(item.blob, item.name)}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-control border border-border bg-elevated px-3.5 text-sm font-medium text-foreground transition-colors hover:border-accent/50 hover:bg-accent/15"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
