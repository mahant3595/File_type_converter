import Link from "next/link";
import type { ToolDef } from "@/lib/catalog";
import { FormatBadge } from "./ui/Badge";

export function PopularStrip({ tools }: { tools: ToolDef[] }) {
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="popular-heading" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="popular-heading" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Popular Conversions
          </h2>
          <p className="mt-0.5 text-sm text-muted">The shortcuts people reach for first.</p>
        </div>
        <Link
          href="/tools"
          className="shrink-0 text-sm text-accent-soft underline-offset-4 transition-colors hover:underline"
        >
          View all
        </Link>
      </div>
      <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tools.map((tool) => {
          const inputExt = tool.inputs.includes("*") ? "any" : tool.inputs[0] ?? "?";
          return (
            <li key={tool.id} className="min-w-[212px] shrink-0 snap-start">
              <Link
                href={`/convert/${tool.id}`}
                className="flex h-full flex-col gap-3 rounded-panel border border-border bg-card px-4 py-3.5 transition-colors duration-150 hover:border-accent/50 hover:bg-elevated/50"
              >
                <span className="text-sm font-semibold text-foreground">{tool.name}</span>
                <span className="flex items-center justify-between gap-2">
                  <FormatBadge from={inputExt} to={tool.output} />
                  <span className="text-xs font-medium text-accent-soft">Convert →</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
