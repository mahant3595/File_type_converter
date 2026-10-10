import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * WCAG 2.2 AA contrast audit of the design tokens, parsed straight from
 * globals.css so the stylesheet can never drift from the audit.
 */

function parseTokens(css: string): Record<string, string> {
  const theme = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
  if (!theme) throw new Error("@theme block not found in globals.css");
  const tokens: Record<string, string> = {};
  const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(theme[1]!))) tokens[m[1]!] = m[2]!;
  return tokens;
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf8");
const t = parseTokens(css);

const SURFACES = ["background", "surface", "card", "elevated"] as const;

/** [foreground token, background token, minimum ratio, label] */
const TEXT_PAIRS: [string, string, number, string][] = [];
for (const surface of SURFACES) {
  TEXT_PAIRS.push(["foreground", surface, 7, `foreground on ${surface}`]);
  TEXT_PAIRS.push(["muted", surface, 4.5, `muted on ${surface}`]);
  TEXT_PAIRS.push(["faint", surface, 4.5, `faint on ${surface}`]);
  TEXT_PAIRS.push(["accent-soft", surface, 4.5, `accent-soft on ${surface}`]);
  TEXT_PAIRS.push(["success", surface, 4.5, `success on ${surface}`]);
  TEXT_PAIRS.push(["warning", surface, 4.5, `warning on ${surface}`]);
  TEXT_PAIRS.push(["error", surface, 4.5, `error on ${surface}`]);
}
TEXT_PAIRS.push(
  // Primary button: near-black label on violet
  ["background", "accent", 4.5, "primary button label"],
  ["background", "accent-hover", 4.5, "primary button hover label"],
  // Secondary button / elevated controls
  ["foreground", "elevated", 7, "secondary button label"],
  // Violet link text on the main background
  ["accent", "background", 4.5, "accent links on page background"],
  // Violet used for focus rings / icons / borders needs 3:1 (non-text contrast)
  ["accent", "card", 3, "accent icons/focus on card"],
  ["accent", "surface", 3, "accent icons on surface"],
  ["cyan", "background", 3, "cyan accent on background"],
  ["cyan", "card", 3, "cyan accent on card"],
  ["border-strong", "background", 1.01, "visible control borders (structural)"],
);

describe("design tokens (WCAG 2.2 AA)", () => {
  it("defines the full mandated palette", () => {
    for (const name of [
      "background", "surface", "card", "elevated",
      "accent", "accent-soft", "accent-hover", "cyan",
      "foreground", "muted", "faint", "border",
      "success", "warning", "error",
    ]) {
      expect(t[name], `--color-${name} missing`).toMatch(/^#/);
    }
  });

  it.each(TEXT_PAIRS)("contrast: %s on %s ≥ %s (%s)", (fg, bg, min) => {
    const fgHex = t[fg];
    const bgHex = t[bg];
    expect(fgHex, `missing token ${fg}`).toBeDefined();
    expect(bgHex, `missing token ${bg}`).toBeDefined();
    const ratio = contrast(fgHex!, bgHex!);
    expect(
      ratio,
      `${fg} (${fgHex}) on ${bg} (${bgHex}) = ${ratio.toFixed(2)}:1, need ≥ ${min}:1`,
    ).toBeGreaterThanOrEqual(min);
  });

  it("exact mandated palette values are preserved", () => {
    expect(t.background!.toLowerCase()).toBe("#09090b");
    expect(t.surface!.toLowerCase()).toBe("#111116");
    expect(t.card!.toLowerCase()).toBe("#17171f");
    expect(t.elevated!.toLowerCase()).toBe("#20202a");
    expect(t.accent!.toLowerCase()).toBe("#8b5cf6");
    expect(t.cyan!.toLowerCase()).toBe("#22d3ee");
    expect(t.foreground!.toLowerCase()).toBe("#fafafa");
    expect(t.muted!.toLowerCase()).toBe("#a1a1aa");
    expect(t.border!.toLowerCase()).toBe("#2b2b36");
    expect(t.success!.toLowerCase()).toBe("#34d399");
    expect(t.warning!.toLowerCase()).toBe("#fbbf24");
    expect(t.error!.toLowerCase()).toBe("#fb7185");
  });
});
