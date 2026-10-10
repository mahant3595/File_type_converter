import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { getAvailableTools } from "@/server/convert/registry";
import { ToolExplorer } from "@/components/ToolExplorer";
import type { CategoryFilter } from "@/components/CategoryTabs";

export const metadata: Metadata = {
  title: "All Tools — every file conversion available",
  description:
    "Browse and search every conversion tool on NEXORA Convert: images, PDF, documents, spreadsheets, audio, video and archives.",
  alternates: { canonical: "/tools" },
};

function parseCategory(raw: string | undefined): CategoryFilter {
  if (!raw) return "all";
  if (raw === "audio-video") return "all";
  if (CATEGORIES.some((c) => c.id === raw)) return raw as CategoryId;
  return "all";
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = parseCategory(typeof params.cat === "string" ? params.cat : undefined);
  const tools = await getAvailableTools();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">All Tools</h1>
          <p className="mt-2 max-w-2xl text-base text-muted">
            Search {tools.length} working conversions by name, format or phrase — for example{" "}
            <span className="font-mono text-foreground">JPG to PNG</span>,{" "}
            <span className="font-mono text-foreground">PDF to Word</span> or{" "}
            <span className="font-mono text-foreground">MP4 to MP3</span>.
          </p>
        </div>
        <Link
          href="/convert"
          className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-elevated px-4 text-sm text-foreground transition-colors hover:border-accent/50 hover:bg-accent/10"
        >
          <Sparkles className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          Not sure? Drop a file instead
        </Link>
      </div>

      <div className="mt-8">
        <ToolExplorer tools={tools} initialQuery={q} initialCategory={category} showSearch />
      </div>
    </div>
  );
}
