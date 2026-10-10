"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import type { ToolDef } from "@/lib/catalog";
import { searchTools } from "@/lib/search";
import { clearSearchHistory, getServerSnapshot, getSnapshot, recordSearch, subscribe } from "@/lib/store";
import { familyOf } from "@/lib/catalog";
import { FormatFamilyIcon } from "./icons";

interface SearchBoxProps {
  tools: ToolDef[];
  /** "hero" = large homepage field, "compact" = navigation field */
  size?: "hero" | "compact";
  placeholder?: string;
  id?: string;
  initialQuery?: string;
  /** Enter with no highlighted option (or empty state submit). */
  onSubmitQuery?: (query: string) => void;
  /** Fired on every keystroke — lets a parent grid filter live. */
  onQueryChange?: (query: string) => void;
}

interface Option {
  kind: "tool" | "recent";
  id: string;
  label: string;
  tool?: ToolDef;
}

const MAX_SUGGESTIONS = 7;

export function SearchBox({
  tools,
  size = "compact",
  placeholder = "Search tools…  e.g. JPG to PNG",
  id = "tool-search",
  initialQuery = "",
  onSubmitQuery,
  onQueryChange,
}: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [submitting, setSubmitting] = React.useState(false);
  const prefs = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const recents = prefs.recentSearches;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close when clicking outside.
  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const options = React.useMemo<Option[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return recents.slice(0, MAX_SUGGESTIONS).map((q) => ({ kind: "recent", id: `recent:${q}`, label: q }));
    }
    return searchTools(tools, trimmed)
      .slice(0, MAX_SUGGESTIONS)
      .map((tool) => ({ kind: "tool", id: tool.id, label: tool.name, tool }));
  }, [query, tools, recents]);

  const resultCount = React.useMemo(
    () => (query.trim() ? searchTools(tools, query.trim()).length : 0),
    [query, tools],
  );

  const announce = React.useMemo(() => {
    if (!open) return "";
    if (query.trim()) {
      if (resultCount === 0) return "No matching tools";
      return resultCount === 1 ? "1 tool found" : `${resultCount} tools found`;
    }
    return recents.length > 0 ? `${recents.length} recent searches` : "";
  }, [open, query, resultCount, recents.length]);

  function openTool(tool: ToolDef) {
    if (query.trim()) recordSearch(query.trim());
    setOpen(false);
    setSubmitting(true);
    router.push(`/convert/${tool.id}`);
  }

  function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    recordSearch(trimmed);
    setOpen(false);
    setSubmitting(true);
    if (onSubmitQuery) onSubmitQuery(trimmed);
    else router.push(`/tools?q=${encodeURIComponent(trimmed)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => (options.length === 0 ? -1 : (i + 1) % options.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = activeIndex >= 0 ? options[activeIndex] : undefined;
      if (active?.kind === "tool" && active.tool) openTool(active.tool);
      else if (active?.kind === "recent") {
        setQuery(active.label);
        setActiveIndex(-1);
      } else runSearch();
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
        setActiveIndex(-1);
      } else if (query) {
        setQuery("");
      }
    }
  }

  function clear() {
    setQuery("");
    onQueryChange?.("");
    setActiveIndex(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  const inputSize =
    size === "hero"
      ? "h-14 rounded-[16px] pl-12 pr-28 text-base sm:text-lg"
      : "h-11 rounded-control pl-10 pr-20 text-sm";
  const iconPos = size === "hero" ? "left-4.5 text-muted" : "left-3.5 text-faint";
  const listboxTop = size === "hero" ? "top-[calc(100%+8px)]" : "top-[calc(100%+6px)]";
  const noResults = open && !!query.trim() && resultCount === 0;
  const showList = open && (options.length > 0 || noResults);

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <Search className={`absolute ${iconPos} top-1/2 h-5 w-5 -translate-y-1/2`} aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && activeIndex >= 0 && options[activeIndex] ? `${id}-opt-${activeIndex}` : undefined
          }
          aria-label="Search conversion tools"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`w-full border border-border bg-card text-foreground placeholder:text-faint transition-colors duration-150 focus:border-accent/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden ${inputSize}`}
        />
        <div className={`absolute ${size === "hero" ? "right-3.5" : "right-2.5"} top-1/2 flex -translate-y-1/2 items-center gap-1.5`}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" /> : null}
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={runSearch}
            aria-label="Search all tools"
            className={`hidden items-center justify-center border border-border bg-elevated font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-accent/15 sm:inline-flex ${
              size === "hero" ? "h-9 rounded-[10px] px-3.5 text-sm" : "h-7 rounded-md px-2.5 text-xs"
            }`}
          >
            Search
          </button>
        </div>
      </div>

      <div id={`${id}-listbox`} role="listbox" aria-label="Tool suggestions" className={`absolute ${listboxTop} left-0 right-0 z-50`}>
        {showList ? (
          <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-pop">
            {query.trim() === "" && recents.length > 0 ? (
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-faint">Recent searches</span>
                <button
                  type="button"
                  onClick={() => clearSearchHistory()}
                  className="text-xs text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : null}
            {options.length > 0 ? (
            <ul className="max-h-[380px] overflow-y-auto py-1">
              {options.map((opt, i) => {
                const isActive = i === activeIndex;
                return (
                  <li key={opt.id} id={`${id}-opt-${i}`} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => (opt.kind === "tool" && opt.tool ? openTool(opt.tool) : setQuery(opt.label))}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isActive ? "bg-accent/12 text-foreground" : "text-muted hover:bg-elevated/60"
                      }`}
                    >
                      {opt.kind === "tool" && opt.tool ? (
                        <>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-elevated text-muted">
                            <FormatFamilyIcon family={familyOf(opt.tool.inputs[0] ?? "")} className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{opt.tool.name}</span>
                            <span className="block truncate text-xs text-faint">{opt.tool.description}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-accent-soft">
                            {opt.tool.inputs[0]?.toUpperCase()} → {opt.tool.output === "*" ? "FILES" : opt.tool.output.toUpperCase()}
                          </span>
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                          <span className="truncate text-sm">{opt.label}</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            ) : null}
            {noResults ? (
              <div className="px-3 py-3 text-xs text-muted">
                No tools match “{query.trim()}”. Try a format like{" "}
                <span className="font-mono text-foreground">JPG to PNG</span>, or browse{" "}
                <span className="font-mono text-foreground">All Tools</span>.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
