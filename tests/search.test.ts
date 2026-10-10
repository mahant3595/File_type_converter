import { describe, expect, it } from "vitest";
import { CATEGORIES, TOOLS, getTool } from "@/lib/catalog";
import { categoryCounts, filterTools, normalizeQuery, popularTools, scoreTool, searchTools } from "@/lib/search";

describe("tool search", () => {
  it("normalizes conversion phrases", () => {
    expect(normalizeQuery("  JPG → PNG ")).toBe("jpg to png");
    expect(normalizeQuery("PDF-to-Word")).toBe("pdf to word");
    expect(normalizeQuery("Convert HEIC files!")).toBe("convert heic files");
  });

  it("finds exact structured queries at the top", () => {
    expect(searchTools(TOOLS, "jpg to png")[0]!.id).toBe("jpg-to-png");
    expect(searchTools(TOOLS, "png to jpg")[0]!.id).toBe("png-to-jpg");
    expect(searchTools(TOOLS, "PDF to Word")[0]!.id).toBe("pdf-to-word");
    expect(searchTools(TOOLS, "mp4 to mp3")[0]!.id).toBe("mp4-to-mp3");
    expect(searchTools(TOOLS, "JPG2PNG")[0]!.id).toBe("jpg-to-png");
  });

  it("is case-insensitive and matches extensions, aliases and categories", () => {
    expect(searchTools(TOOLS, "WeBp")[0]!.category).toBe("images");
    expect(searchTools(TOOLS, "excel to csv")[0]!.id).toBe("xlsx-to-csv");
    expect(searchTools(TOOLS, "extract audio").map((t) => t.id)).toContain("mp4-to-mp3");
    expect(searchTools(TOOLS, "unzip")[0]!.id).toBe("extract-zip");
    expect(searchTools(TOOLS, "spreadsheets").every((t) => t.category === "spreadsheets")).toBe(true);
  });

  it("only returns real tools — unsupported formats return nothing", () => {
    expect(searchTools(TOOLS, "heic to jpg")).toEqual([]);
    expect(searchTools(TOOLS, "doc to pdf")).toEqual([]);
    expect(searchTools(TOOLS, "word to pdf")).toEqual([]); // Word→PDF engine not available
    expect(searchTools(TOOLS, "rar to zip")).toEqual([]);
    expect(searchTools(TOOLS, "convert heic")).toEqual([]);
    expect(searchTools(TOOLS, "xyzzy")).toEqual([]);
  });

  it("scores structured pairs above unrelated matches", () => {
    const pair = scoreTool(getTool("jpg-to-png")!, normalizeQuery("jpg to png"));
    const other = scoreTool(getTool("mp4-to-mp3")!, normalizeQuery("jpg to png"));
    expect(pair).toBeGreaterThan(other);
    expect(other).toBe(0);
  });

  it("empty query returns every tool unfiltered", () => {
    expect(searchTools(TOOLS, "")).toHaveLength(TOOLS.length);
    expect(searchTools(TOOLS, "   ")).toHaveLength(TOOLS.length);
  });

  it("category filters preserve the query", () => {
    const res = filterTools(TOOLS, { query: "jpg to pdf", category: "pdf" });
    expect(res.map((t) => t.id)).toEqual(["jpg-to-pdf"]);
    const empty = filterTools(TOOLS, { query: "zzzz", category: "images" });
    expect(empty).toEqual([]);
  });

  it("category counts only count existing tools", () => {
    const counts = categoryCounts(TOOLS);
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(TOOLS.length);
    expect(counts.presentations).toBeGreaterThan(0);
    for (const c of CATEGORIES) expect(counts[c.id]).toBeGreaterThanOrEqual(0);
  });

  it("popular strip is curated and non-empty", () => {
    const pop = popularTools(TOOLS, 8);
    expect(pop.length).toBeGreaterThanOrEqual(6);
    expect(pop[0]!.id).toBe("jpg-to-png");
    expect(new Set(pop.map((t) => t.id)).size).toBe(pop.length);
  });
});
