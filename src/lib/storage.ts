/**
 * Browser-local storage (client only). Everything here stays in this browser —
 * no account, no server. Failures are swallowed so SSR/private mode never crash.
 */
const PREFIX = "nexora.";

export const STORAGE_KEYS = {
  favorites: `${PREFIX}favorites`,
  recentSearches: `${PREFIX}recent-searches`,
  recentTools: `${PREFIX}recent-tools`,
} as const;

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota or private mode — ignore */
  }
}

function readList(key: string): string[] {
  const raw = safeGet(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function readFavorites(): string[] {
  return readList(STORAGE_KEYS.favorites);
}

export function writeFavorites(ids: string[]): void {
  safeSet(STORAGE_KEYS.favorites, JSON.stringify(ids.slice(0, 100)));
}

export function readRecentSearches(): string[] {
  return readList(STORAGE_KEYS.recentSearches);
}

export function pushRecentSearch(query: string): string[] {
  const q = query.trim().slice(0, 80);
  if (!q) return readRecentSearches();
  const next = [q, ...readRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  safeSet(STORAGE_KEYS.recentSearches, JSON.stringify(next));
  return next;
}

export function clearRecentSearches(): void {
  safeSet(STORAGE_KEYS.recentSearches, "[]");
}

export function readRecentTools(): string[] {
  return readList(STORAGE_KEYS.recentTools);
}

export function pushRecentTool(id: string): string[] {
  const next = [id, ...readRecentTools().filter((t) => t !== id)].slice(0, 8);
  safeSet(STORAGE_KEYS.recentTools, JSON.stringify(next));
  return next;
}

export function clearRecentTools(): void {
  safeSet(STORAGE_KEYS.recentTools, "[]");
}
