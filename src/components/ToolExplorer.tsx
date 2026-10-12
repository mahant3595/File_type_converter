"use client";

import * as React from "react";
import type { ToolDef } from "@/lib/catalog";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { categoryCounts, filterTools, popularTools } from "@/lib/search";
import { CategoryTabs, type CategoryFilter } from "./CategoryTabs";
import { ToolCard } from "./ToolCard";
import { SearchBox } from "./SearchBox";
import { EmptyState } from "./ui/EmptyState";
import { Button } from "./ui/Button";
import { FormatBadge } from "./ui/Badge";
import Link from "next/link";

/**
 * Current `location.search` as an external store. Server snapshot is a stable
 * empty string, so static export/prerender never reads `window`, and the value
 * updates on back/forward navigation without setState-in-effect.
 */
function subscribeLocationSearch(notify: () => void): () => void {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
function getLocationSearch(): string {
  return window.location.search;
}
function useLocationSearch(): string {
  return React.useSyncExternalStore(subscribeLocationSearch, getLocationSearch, () => "");
}

function paramFrom(search: string, key: string): string {
  return new URLSearchParams(search).get(key) ?? "";
}

function parseUrlCategory(raw: string): CategoryFilter {
  if (!raw || raw === "audio-video") return "all";
  return CATEGORIES.some((c) => c.id === raw) ? (raw as CategoryId) : "all";
}

interface ToolExplorerProps {
  tools: ToolDef[];
  initialCategory?: CategoryFilter;
  /** Render the in-explorer search field (used on /tools and category pages). */
  showSearch?: boolean;
  /** Hide the category rail (used on merged category pages like Audio & Video). */
  showTabs?: boolean;
}

export function ToolExplorer({
  tools,
  initialCategory = "all",
  showSearch = false,
  showTabs = true,
}: ToolExplorerProps) {
  // Deep-links like /tools?q=jpg%20to%20png are applied client-side so the page
  // can be fully static. Once the user interacts, their state wins.
  const search = useLocationSearch();
  const [typedQuery, setTypedQuery] = React.useState<string | null>(null);
  const [typedCategory, setTypedCategory] = React.useState<CategoryFilter | null>(null);
  const query = typedQuery ?? paramFrom(search, "q");
  const category =
    typedCategory ??
    (initialCategory !== "all" ? initialCategory : parseUrlCategory(paramFrom(search, "cat")));
  const setQuery = React.useCallback((q: string) => setTypedQuery(q), []);
  const setCategory = React.useCallback((c: CategoryFilter) => setTypedCategory(c), []);

  const counts = React.useMemo(() => {
    const base = categoryCounts(tools);
    return { ...base, total: tools.length };
  }, [tools]);

  const results = React.useMemo(() => filterTools(tools, { query, category }), [tools, query, category]);
  const categoryLabel =
    category === "all" ? "all categories" : (CATEGORIES.find((c) => c.id === category)?.label ?? category);
  const filtering = query.trim().length > 0 || category !== "all";

  const suggestions = React.useMemo(() => popularTools(tools, 3), [tools]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        {showSearch ? (
          <div className="max-w-xl">
            <SearchBox
              tools={tools}
              size="compact"
              id="explorer-search"
              key={query}
              initialQuery={query}
              onSubmitQuery={(q) => setQuery(q)}
              onQueryChange={(q) => setQuery(q)}
              placeholder="Search by name, format or phrase…"
            />
          </div>
        ) : null}
        {showTabs ? <CategoryTabs active={category} counts={counts} onChange={setCategory} /> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">
          {results.length === 1 ? "1 tool" : `${results.length} tools`}
          {query.trim() ? (
            <>
              {" "}
              matching <span className="font-medium text-foreground">“{query.trim()}”</span>
            </>
          ) : null}
          {category !== "all" ? <> in {categoryLabel}</> : null}
        </p>
        {filtering ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {results.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((tool) => (
              <li key={tool.id} className="h-full">
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No tools match your search"
            message={`We could not find a conversion for ${query.trim() ? `“${query.trim()}”` : "that filter"}${category !== "all" ? ` in ${categoryLabel}` : ""}. Only tools that actually work are listed here — try one of these instead:`}
          >
            {suggestions.map((tool) => (
              <Link
                key={tool.id}
                href={`/convert/${tool.id}`}
                className="inline-flex items-center gap-2 rounded-control border border-border bg-card px-3.5 py-2 text-sm text-foreground transition-colors hover:border-accent/50 hover:bg-elevated"
              >
                {tool.name}
                <FormatBadge
                  from={tool.inputs.includes("*") ? "any" : tool.inputs[0] ?? "?"}
                  to={tool.output}
                  className="border-0 bg-transparent px-0"
                />
              </Link>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
            >
              Browse all tools
            </Button>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
