/**
 * Tool search & filtering (pure, isomorphic).
 * Matching is case-insensitive over tool names, extensions, categories and
 * common conversion phrases ("jpg to png", "pdf to word", "extract audio").
 */
import { CATEGORIES, FORMAT_FAMILY, type CategoryId, type ToolDef } from "./catalog";

/** Human phrase → canonical format token. */
const TOKEN_ALIAS: Record<string, string> = {
  jpeg: "jpg", jpgs: "jpg", jpegs: "jpg",
  pictures: "png", picture: "png", photos: "jpg", photo: "jpg", image: "png",
  word: "docx", doc: "docx", microsoft: "docx",
  excel: "xlsx", sheets: "xlsx", sheet: "xlsx", spreadsheet: "xlsx",
  powerpoint: "pptx", slides: "pptx", deck: "pptx",
  text: "txt", plaintext: "txt", "plain": "txt",
  markdown: "md", mark: "md",
  quicktime: "mov", "matroska": "mkv", video: "mp4", audio: "mp3", music: "mp3",
  archive: "zip", unpack: "extract", unarchive: "extract",
};

function canonical(token: string): string {
  return TOKEN_ALIAS[token] ?? token;
}

export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[→⟶>]+/g, " to ")
    .replace(/(?<=[a-z0-9])2(?=[a-z])/g, " to ") // jpg2png → jpg to png
    .replace(/[_/\\.,:;!?()[\]'"`~@#$%^&*+=|{}<>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that carry no signal on their own. */
const STOPWORDS = new Set(["to", "a", "an", "the", "into", "of", "in", "on", "for", "my", "with", "and", "or", "convert"]);

function tokensOfFiltered(q: string): string[] {
  return tokensOf(q).filter((t) => !STOPWORDS.has(t));
}

/** Is this token a format the product knows about (extension or alias)? */
function isKnownFormat(token: string): boolean {
  const candidates = [token, canonical(token), singular(token), singular(canonical(token))];
  return candidates.some((c) => c && c in FORMAT_FAMILY);
}

function tokensOf(q: string): string[] {
  return q.split(" ").filter(Boolean);
}

function singular(t: string): string {
  return t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
}

const PAIR_RE = /^(.{1,24}?)\s+to\s+(.{1,24})$/;

function extMatches(token: string, exts: string[]): boolean {
  const c = canonical(token);
  const s = singular(c);
  return exts.some((e) => e === c || e === s || canonical(e) === c || canonical(e) === s);
}

/** Relevance score; 0 means "no match". Exact structured queries score highest. */
export function scoreTool(tool: ToolDef, normalizedQuery: string): number {
  if (!normalizedQuery) return 1;
  const name = tool.name.toLowerCase();
  const id = tool.id;
  const catLabel = (CATEGORIES.find((c) => c.id === tool.category)?.label ?? "").toLowerCase();
  const tokens = tokensOfFiltered(normalizedQuery);

  if (normalizedQuery === id || normalizedQuery === name) return 1000;
  if (id.startsWith(normalizedQuery)) return 800;
  if (name.startsWith(normalizedQuery)) return 700;

  let score = 0;

  // Structured "X to Y" query against inputs → output.
  const pair = PAIR_RE.exec(normalizedQuery);
  if (pair) {
    const from = (pair[1] ?? "").trim();
    const to = (pair[2] ?? "").trim();
    // Wildcard tools only match non-format sources ("files", "photos").
    const fromOk = extMatches(from, tool.inputs) || (tool.inputs.includes("*") && !isKnownFormat(from));
    const toOk =
      extMatches(to, [tool.output]) ||
      (tool.output === "*" && (to === "extract" || to === "unzip" || to === "files"));
    const fromKnown = isKnownFormat(from);
    const toKnown = isKnownFormat(to) || to === "extract" || to === "unzip";
    // A structured query that names formats we do not handle here must not
    // leak into loosely related tools: be honest and return no match.
    if (fromKnown && !fromOk) return 0;
    if (toKnown && !toOk) return 0;
    if (fromOk && toOk) score = Math.max(score, 900);
    else if (fromOk) score = Math.max(score, 420);
    else if (toOk) score = Math.max(score, 360);
  }

  // Phrase containment.
  if (name.includes(normalizedQuery)) score = Math.max(score, 650);
  if (tool.keywords.some((k) => k.includes(normalizedQuery))) score = Math.max(score, 600);

  // Token coverage over all searchable text.
  const searchable = [
    name,
    id.replace(/-/g, " "),
    tool.keywords.join(" "),
    tool.inputs.join(" "),
    tool.output,
    tool.output === "*" ? "files" : "",
    catLabel,
  ].join(" \n ");

  let hits = 0;
  for (const rawToken of tokens) {
    const variants = [rawToken, singular(rawToken), canonical(rawToken)];
    const hit = variants.some((v) => v && searchable.includes(v));
    if (isKnownFormat(rawToken) && !hit) {
      // The query names a format this tool does not touch — never pad results.
      return 0;
    }
    if (hit) hits += 1;
  }
  if (hits === tokens.length && tokens.length > 0) {
    score = Math.max(score, 300 + Math.min(100, tokens.length * 25));
  } else if (hits > 0) {
    score = Math.max(score, 60 * hits);
  }

  return score;
}

/** Ranked search results (only tools that actually match). */
export function searchTools(tools: ToolDef[], query: string): ToolDef[] {
  const q = normalizeQuery(query);
  if (!q) return tools.slice();
  const scored: { tool: ToolDef; score: number }[] = [];
  for (const tool of tools) {
    const score = scoreTool(tool, q);
    if (score > 0) scored.push({ tool, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.tool.popular ?? 999) - (b.tool.popular ?? 999) ||
      a.tool.name.localeCompare(b.tool.name),
  );
  return scored.map((s) => s.tool);
}

export interface FilterState {
  query?: string;
  category?: CategoryId | "all";
}

/** Search + category filter in one step; preserves query. */
export function filterTools(tools: ToolDef[], state: FilterState): ToolDef[] {
  let out = searchTools(tools, state.query ?? "");
  if (state.category && state.category !== "all") {
    out = out.filter((t) => t.category === state.category);
  }
  return out;
}

/** Counts of genuinely available tools per category. */
export function categoryCounts(tools: ToolDef[]): Record<CategoryId, number> {
  const counts = {} as Record<CategoryId, number>;
  for (const c of CATEGORIES) counts[c.id] = 0;
  for (const t of tools) counts[t.category] = (counts[t.category] ?? 0) + 1;
  return counts;
}

/** Popular strip, in curated order. */
export function popularTools(tools: ToolDef[], limit = 8): ToolDef[] {
  return tools
    .filter((t) => typeof t.popular === "number")
    .sort((a, b) => (a.popular ?? 0) - (b.popular ?? 0))
    .slice(0, limit);
}

/** Resolve a tool's related tools, skipping unavailable ones. */
export function relatedTools(tool: ToolDef, tools: ToolDef[], limit = 4): ToolDef[] {
  const byId = new Map(tools.map((t) => [t.id, t]));
  const out: ToolDef[] = [];
  for (const id of tool.related ?? []) {
    const rel = byId.get(id);
    if (rel && rel.id !== tool.id) out.push(rel);
    if (out.length >= limit) break;
  }
  return out;
}
