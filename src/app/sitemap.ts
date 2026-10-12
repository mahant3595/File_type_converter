import type { MetadataRoute } from "next";
import { CATEGORIES, TOOLS } from "@/lib/catalog";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Static metadata route (required for `output: export`).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ["", "/tools", "/convert", "/help", "/privacy", "/terms", "/favorites"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  const categoryRoutes = [...CATEGORIES.map((c) => c.id), "audio-video"].map((slug) => ({
    url: `${BASE}/category/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const toolRoutes = TOOLS.map((t) => ({
    url: `${BASE}/convert/${t.id}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...staticRoutes, ...categoryRoutes, ...toolRoutes];
}
