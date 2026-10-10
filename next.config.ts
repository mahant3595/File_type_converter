import type { NextConfig } from "next";

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
};

export default nextConfig;
