"use client";

import Link from "next/link";
import { History, Star, X } from "lucide-react";
import { getTool, familyOf } from "@/lib/catalog";
import { useFavorites } from "./FavoritesProvider";
import { FormatFamilyIcon } from "./icons";

/**
 * Favorites + recently opened tools. Everything here is stored only in this
 * browser (localStorage) — no account, no server sync.
 */
export function YourTools() {
  const { favorites, recentTools, hydrated, toggleFavorite, clearRecents } = useFavorites();
  if (!hydrated || (favorites.length === 0 && recentTools.length === 0)) return null;

  const favTools = favorites.map(getTool).filter((t): t is NonNullable<typeof t> => !!t);
  const recent = recentTools
    .map(getTool)
    .filter((t): t is NonNullable<typeof t> => !!t)
    .slice(0, 6);

  return (
    <section aria-labelledby="your-tools-heading" className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="your-tools-heading" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Your tools
          </h2>
          <p className="mt-0.5 text-sm text-muted">Stored only in this browser — nothing is uploaded.</p>
        </div>
        <Link href="/favorites" className="text-sm text-accent-soft underline-offset-4 transition-colors hover:underline">
          Manage
        </Link>
      </div>

      {favTools.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            <Star className="h-3.5 w-3.5" aria-hidden="true" /> Favorites
          </h3>
          <ul className="flex flex-wrap gap-2">
            {favTools.map((tool) => (
              <li key={tool.id}>
                <span className="inline-flex items-center gap-2 rounded-control border border-border bg-card py-1.5 pl-3 pr-1.5 text-sm">
                  <FormatFamilyIcon
                    family={tool.output === "*" ? familyOf(tool.inputs[0] ?? "") : familyOf(tool.output)}
                    className="h-4 w-4 text-muted"
                  />
                  <Link href={`/convert/${tool.id}`} className="text-foreground transition-colors hover:text-accent-soft">
                    {tool.name}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${tool.name} from favorites`}
                    onClick={() => toggleFavorite(tool.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-elevated hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
              <History className="h-3.5 w-3.5" aria-hidden="true" /> Recently used
            </h3>
            <button
              type="button"
              onClick={clearRecents}
              className="text-xs text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Clear history
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/convert/${tool.id}`}
                  className="inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  <FormatFamilyIcon
                    family={tool.output === "*" ? familyOf(tool.inputs[0] ?? "") : familyOf(tool.output)}
                    className="h-4 w-4"
                  />
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
