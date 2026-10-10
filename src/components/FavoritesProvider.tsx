"use client";

import * as React from "react";
import {
  clearToolHistory,
  getServerSnapshot,
  getSnapshot,
  isServerPrefs,
  recordToolOpen,
  subscribe,
  toggleFavorite,
} from "@/lib/store";

interface FavoritesValue {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  recentTools: string[];
  openTool: (id: string) => void;
  clearRecents: () => void;
  /** false until localStorage has been read (prevents hydration mismatches) */
  hydrated: boolean;
}

const FavoritesContext = React.createContext<FavoritesValue | null>(null);

export function useFavorites(): FavoritesValue {
  const ctx = React.useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const prefs = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = !isServerPrefs(prefs);

  const value = React.useMemo<FavoritesValue>(
    () => ({
      favorites: prefs.favorites,
      recentTools: prefs.recentTools,
      hydrated,
      isFavorite: (id) => prefs.favorites.includes(id),
      toggleFavorite,
      openTool: recordToolOpen,
      clearRecents: clearToolHistory,
    }),
    [prefs, hydrated],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
