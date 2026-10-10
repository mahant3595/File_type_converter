import { access } from "node:fs/promises";

export interface Capabilities {
  /** ffmpeg binary available (audio/video tools). */
  ffmpeg: boolean;
}

let cached: Capabilities | null = null;

async function hasFfmpeg(): Promise<boolean> {
  const explicit = process.env.FFMPEG_PATH;
  if (explicit) {
    try {
      await access(explicit);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const mod = await import("ffmpeg-static");
    const p = (mod as { default?: string | null }).default;
    if (!p) return false;
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Detect runtime capabilities once per process. */
export async function getCapabilities(): Promise<Capabilities> {
  if (cached) return cached;
  cached = { ffmpeg: await hasFfmpeg() };
  return cached;
}

export async function ffmpegPath(): Promise<string> {
  const explicit = process.env.FFMPEG_PATH;
  if (explicit) return explicit;
  const mod = await import("ffmpeg-static");
  const p = (mod as { default?: string | null }).default;
  if (!p) throw new Error("ffmpeg unavailable");
  return p;
}
