"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "./FavoritesProvider";

export function FavoriteButton({
  toolId,
  toolName,
  className = "",
}: {
  toolId: string;
  toolName: string;
  className?: string;
}) {
  const { isFavorite, toggleFavorite, hydrated } = useFavorites();
  const active = hydrated && isFavorite(toolId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active ? `Remove ${toolName} from favorites` : `Add ${toolName} to favorites`
      }
      title={active ? "Remove from favorites" : "Add to favorites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(toolId);
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors duration-150 ${
        active
          ? "border-accent/50 bg-accent/15 text-accent-soft"
          : "border-border bg-surface/80 text-faint opacity-0 hover:border-border-strong hover:text-muted focus-visible:opacity-100 group-hover:opacity-100"
      } ${className}`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-accent" : ""}`} aria-hidden="true" />
    </button>
  );
}
