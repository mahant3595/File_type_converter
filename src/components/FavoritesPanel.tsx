"use client";

import Link from "next/link";
import { History, Star, Trash2 } from "lucide-react";
import { getTool, familyOf } from "@/lib/catalog";
import { useFavorites } from "./FavoritesProvider";
import { ToolCard } from "./ToolCard";
import { EmptyState } from "./ui/EmptyState";
import { Button } from "./ui/Button";

export function FavoritesPanel() {
  const { favorites, recentTools, hydrated, clearRecents } = useFavorites();

  if (!hydrated) {
    return (
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded-card border border-border bg-card" />
        <div className="h-24 rounded-card border border-border bg-card" />
      </div>
    );
  }

  const favTools = favorites.map(getTool).filter((t): t is NonNullable<typeof t> => !!t);
  const recent = recentTools.map(getTool).filter((t): t is NonNullable<typeof t> => !!t);

  if (favTools.length === 0 && recent.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        message="Star tools on the dashboard to pin them here, and anything you open will show up under Recently used. Everything is stored only in this browser."
      >
        <ButtonLink href="/tools">Browse all tools</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Go to dashboard
        </ButtonLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="fav-heading">
        <h2 id="fav-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Star className="h-4.5 w-4.5 text-accent-soft" aria-hidden="true" />
          Favorites
          <span className="text-sm font-normal text-faint">({favTools.length})</span>
        </h2>
        {favTools.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card px-5 py-6 text-sm text-muted">
            No favorites yet — tap the heart on any tool card to pin it here.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favTools.map((tool) => (
              <li key={tool.id} className="h-full">
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <History className="h-4.5 w-4.5 text-cyan" aria-hidden="true" />
            Recently used
            <span className="text-sm font-normal text-faint">({recent.length})</span>
          </h2>
          {recent.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearRecents}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear history
            </Button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card px-5 py-6 text-sm text-muted">
            Tools you open will appear here.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2.5">
            {recent.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/convert/${tool.id}`}
                  className="inline-flex items-center gap-2 rounded-control border border-border bg-card px-3.5 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                >
                  <span className="text-faint">
                    {familyOf(tool.output === "*" ? (tool.inputs[0] ?? "") : tool.output) === "unknown"
                      ? "•"
                      : ""}
                  </span>
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs leading-relaxed text-faint">
        Favorites and recent tools are saved in this browser&apos;s local storage only. Clearing your browser data
        removes them, and they are never uploaded anywhere.
      </p>
    </div>
  );
}

function ButtonLink(props: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  const { href, children, variant = "primary" } = props;
  return (
    <Link
      href={href}
      className={
        variant === "primary"
          ? "inline-flex h-10 items-center rounded-control border border-transparent bg-accent px-4 text-sm font-semibold text-background transition-colors hover:bg-accent-hover"
          : "inline-flex h-10 items-center rounded-control border border-border bg-elevated px-4 text-sm text-foreground transition-colors hover:border-border-strong"
      }
    >
      {children}
    </Link>
  );
}
