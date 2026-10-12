import type { NextConfig } from "next";

/**
 * Two build modes:
 *  - default           → full server build (`next start` runs the conversion API)
 *  - NEXT_OUTPUT=export → static export for GitHub Pages (no API; the client
 *                         degrades honestly) with NEXT_BASE_PATH as the sub-path
 *                         (e.g. /File_type_converter for project pages).
 */
const isExport = process.env.NEXT_OUTPUT === "export";
const basePath = isExport ? (process.env.NEXT_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  // Native / dynamically-required conversion engines stay outside the bundler.
  serverExternalPackages: [
    "sharp",
    "canvas",
    "ffmpeg-static",
    "pdfjs-dist",
    "mammoth",
    "xlsx",
    "adm-zip",
    "tar",
    "file-type",
  ],
  poweredByHeader: false,
  env: {
    // Inlined into the client bundle so raw XHR calls honour the sub-path.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // `trailingSlash` makes every route a directory/index.html on disk, which is
  // what static hosts (GitHub Pages) resolve reliably without clean-URL support.
  ...(isExport ? { output: "export" as const, basePath, trailingSlash: true } : {}),
};

export default nextConfig;
