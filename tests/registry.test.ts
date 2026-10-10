import { describe, expect, it } from "vitest";
import { CATEGORIES, TOOLS, resolveOptions, getTool } from "@/lib/catalog";
import { HANDLER_LIMITS, limitsFor } from "@/lib/limits";
import { HANDLER_MAP, getAvailableTools, isToolAvailable, registryIssues } from "@/server/convert/registry";
import { getCapabilities } from "@/server/convert/capabilities";

describe("conversion registry integrity", () => {
  it("has no catalog ↔ registry mismatches", () => {
    expect(registryIssues()).toEqual([]);
  });

  it("every tool id is a unique URL slug", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("every tool belongs to a declared category and carries a description", () => {
    const categoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const tool of TOOLS) {
      expect(categoryIds.has(tool.category)).toBe(true);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.name.length).toBeGreaterThan(2);
    }
  });

  it("shared limits module matches the limits enforced by each handler", () => {
    for (const tool of TOOLS) {
      const handler = HANDLER_MAP.get(tool.handler);
      expect(handler, `handler missing for ${tool.id}`).toBeDefined();
      const shared = HANDLER_LIMITS[tool.handler];
      expect(shared, `HANDLER_LIMITS missing "${tool.handler}"`).toBeDefined();
      expect(shared!.maxBytesPerFile).toBe(handler!.maxBytesPerFile);
      expect(shared!.maxFiles).toBe(handler!.maxFiles);
      const limits = limitsFor(tool);
      expect(limits.maxFiles).toBeLessThanOrEqual(handler!.maxFiles);
      expect(limits.maxBytesPerFile).toBe(handler!.maxBytesPerFile);
    }
  });

  it("all tools are available in this environment (or gated only by ffmpeg)", async () => {
    const caps = await getCapabilities();
    const available = await getAvailableTools();
    for (const tool of TOOLS) {
      const ok = await isToolAvailable(tool);
      if (tool.handler === "av") expect(ok).toBe(caps.ffmpeg);
      else expect(ok).toBe(true);
    }
    expect(available.length).toBe(TOOLS.length - (caps.ffmpeg ? 0 : TOOLS.filter((t) => t.handler === "av").length));
  });

  it("resolveOptions applies defaults, clamps ranges and rejects unknown selects", () => {
    const pdfToJpg = getTool("pdf-to-jpg")!;
    expect(resolveOptions(pdfToJpg, {})).toEqual({ dpi: "150", pages: "" });
    expect(resolveOptions(pdfToJpg, { dpi: "300" }).dpi).toBe("300");
    expect(resolveOptions(pdfToJpg, { dpi: "nope" }).dpi).toBe("150");
    expect(resolveOptions(pdfToJpg, { dpi: "72", pages: "1-2" })).toEqual({ dpi: "72", pages: "1-2" });

    const jpgToWebp = getTool("jpg-to-webp")!;
    expect(resolveOptions(jpgToWebp, {}).quality).toBe(90);
    expect(resolveOptions(jpgToWebp, { quality: "500" }).quality).toBe(100);
    expect(resolveOptions(jpgToWebp, { quality: "-3" }).quality).toBe(1);
    expect(resolveOptions(jpgToWebp, { quality: "abc" }).quality).toBe(90);

    const jpgToPng = getTool("jpg-to-png")!;
    expect(resolveOptions(jpgToPng, { maxWidth: "99999" }).maxWidth).toBe(10000);
    expect(resolveOptions(jpgToPng, { maxWidth: "-4" }).maxWidth).toBe(0);
  });

  it("popular tools are a genuine subset with stable ordering", () => {
    const popular = TOOLS.filter((t) => t.popular).sort((a, b) => a.popular! - b.popular!);
    expect(popular.length).toBeGreaterThanOrEqual(6);
    const ranks = popular.map((t) => t.popular);
    expect(new Set(ranks).size).toBe(ranks.length);
    for (const t of popular) expect(HANDLER_MAP.has(t.handler)).toBe(true);
  });
});
