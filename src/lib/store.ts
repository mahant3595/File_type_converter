/**
 * Browser-preferences external store (client only).
 *
 * localStorage is an external system, so it is exposed with
 * useSyncExternalStore instead of setState-in-effect. All writes go through
 * the mutation helpers below, which invalidate the cache and notify
 * subscribers. The server snapshot is a stable empty object, which also
 * gives us a reliable "hydrated" signal (client snapshots are new objects).
 */
import {
  clearRecentSearches,
  clearRecentTools,
  pushRecentSearch,
  pushRecentTool,
  readFavorites,
  readRecentSearches,
  readRecentTools,
  writeFavorites,
} from "./storage";

export interface BrowserPrefs {
  favorites: string[];
  recentSearches: string[];
  recentTools: string[];
}

const EMPTY: BrowserPrefs = { favorites: [], recentSearches: [], recentTools: [] };

let snapshot: BrowserPrefs | null = null;
const listeners = new Set<() => void>();

function readAll(): BrowserPrefs {
  return {
    favorites: readFavorites(),
    recentSearches: readRecentSearches(),
    recentTools: readRecentTools(),
  };
}

function emit(): void {
  snapshot = null;
  for (const listener of listeners) listener();
}

export function getSnapshot(): BrowserPrefs {
  if (!snapshot) snapshot = readAll();
  return snapshot;
}

export function getServerSnapshot(): BrowserPrefs {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep in sync when another tab changes the preferences.
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith("nexora.")) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function isServerPrefs(prefs: BrowserPrefs): boolean {
  return prefs === EMPTY;
}

/* ------------------------------- mutations ------------------------------- */

export function toggleFavorite(id: string): void {
  const current = getSnapshot().favorites;
  const next = current.includes(id) ? current.filter((f) => f !== id) : [id, ...current];
  writeFavorites(next);
  emit();
}

export function recordSearch(query: string): void {
  pushRecentSearch(query);
  emit();
}

export function recordToolOpen(id: string): void {
  pushRecentTool(id);
  emit();
}

export function clearSearchHistory(): void {
  clearRecentSearches();
  emit();
}

export function clearToolHistory(): void {
  clearRecentTools();
  emit();
}
