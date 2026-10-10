import * as React from "react";

/** Small format chip, e.g. `JPG → PNG`. */
export function FormatBadge({
  from,
  to,
  className = "",
}: {
  from: string;
  to: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[11px] tracking-wide text-muted ${className}`}
    >
      <span className="text-foreground/80">{from.toUpperCase()}</span>
      <span aria-hidden="true" className="text-accent-soft">
        →
      </span>
      <span className="text-foreground/80">{to === "*" ? "FILES" : to.toUpperCase()}</span>
    </span>
  );
}

export function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full border border-border bg-surface px-1.5 py-px text-[11px] tabular-nums text-faint">
      {count}
    </span>
  );
}
