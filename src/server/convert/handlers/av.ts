import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ffmpegPath } from "../capabilities";
import type { ConversionHandler, OutputFile } from "../types";
import { ConvertError } from "../errors";
import { resolveOptions } from "@/lib/catalog";
import { extensionOf, stripExtension } from "@/lib/validate";

const TIMEOUT_MS = 8 * 60 * 1000;

function buildFfmpegArgs(
  toolId: string,
  output: string,
  opts: Record<string, string | number>,
  inPath: string,
  outPath: string,
): string[] {
  const base = ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inPath];
  switch (toolId) {
    case "wav-to-mp3":
    case "flac-to-mp3":
    case "ogg-to-mp3":
    case "m4a-to-mp3":
    case "mp4-to-mp3":
      return [...base, "-vn", "-c:a", "libmp3lame", "-b:a", String(opts.bitrate ?? "192k"), outPath];
    case "mp3-to-wav":
      return [...base, "-vn", "-c:a", "pcm_s16le", outPath];
    case "wav-to-flac":
      return [...base, "-vn", "-c:a", "flac", outPath];
    case "mp4-to-webm":
      return [
        ...base,
        "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(opts.crf ?? "32"),
        "-deadline", "good", "-cpu-used", "4", "-row-mt", "1",
        "-pix_fmt", "yuv420p",
        "-c:a", "libopus", "-b:a", "128k",
        outPath,
      ];
    case "mp4-to-gif":
      return [
        ...base,
        "-vf", `fps=${Number(opts.fps ?? 12)},scale=480:-2:flags=lanczos`,
        "-loop", "0", "-an",
        outPath,
      ];
    default:
      // mp4-family outputs (webm/mov/mkv/avi → mp4)
      if (output === "mp4") {
        return [
          ...base,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart",
          outPath,
        ];
      }
      return [...base, outPath];
  }
}

function sanitizeFfmpegError(stderr: string, tmpDir: string): ConvertError {
  const cleaned = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(tmpDir).join(""))
    .join(" ");
  if (/Unknown encoder|encoder not found/i.test(cleaned)) {
    return new ConvertError("conversion_failed", "This format cannot be encoded by the media engine.");
  }
  if (/Invalid data|moov atom|does not contain any stream|invalid argument when reading/i.test(cleaned)) {
    return new ConvertError("corrupt_file", "This media file could not be decoded. It may be corrupted or use an unsupported codec.");
  }
  if (/No such file|Permission denied/i.test(cleaned)) {
    return new ConvertError("invalid_file", "The media file could not be read.");
  }
  return new ConvertError(
    "conversion_failed",
    "The media conversion failed. The file may be corrupted or use an unsupported codec.",
  );
}

function runFfmpeg(ffmpeg: string, args: string[], tmpDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ConvertError("timeout", "The conversion took too long and was stopped. Try a smaller file."));
    }, TIMEOUT_MS);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new ConvertError("conversion_failed", "The media engine could not be started."));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(sanitizeFfmpegError(stderr, tmpDir));
    });
  });
}

/** Audio/video conversion via ffmpeg (temp files are deleted immediately after). */
const avHandler: ConversionHandler = {
  id: "av",
  maxBytesPerFile: 250 * 1024 * 1024,
  maxFiles: 10,
  async run({ tool, files, options }) {
    const opts = resolveOptions(tool, options);
    const ffmpeg = await ffmpegPath();
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "nexora-"));
    const outputs: OutputFile[] = [];
    const used = new Set<string>();
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const inExt = extensionOf(file.name) || "bin";
        const inPath = path.join(tmpDir, `in-${i}.${inExt}`);
        const outPath = path.join(tmpDir, `out-${i}.${tool.output}`);
        await writeFile(inPath, file.data, { mode: 0o600 });

        const args = buildFfmpegArgs(tool.id, tool.output, opts, inPath, outPath);
        try {
          await runFfmpeg(ffmpeg, args, tmpDir);
        } catch (e) {
          if (e instanceof ConvertError && e.code === "conversion_failed") {
            throw new ConvertError("conversion_failed", `"${file.name}": ${e.message}`);
          }
          throw e;
        }

        let data: Buffer;
        try {
          data = await readFile(outPath);
        } catch {
          throw new ConvertError("conversion_failed", `"${file.name}" produced no output. It may use an unsupported codec.`);
        }
        if (data.length === 0) {
          throw new ConvertError("conversion_failed", `"${file.name}" produced an empty file.`);
        }
        let name = `${stripExtension(file.name)}.${tool.output}`;
        if (used.has(name.toLowerCase())) name = `${stripExtension(file.name)}-${used.size + 1}.${tool.output}`;
        used.add(name.toLowerCase());
        outputs.push({ name, mime: tool.outputMime, data });
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (outputs.length === 0) throw new ConvertError("invalid_file", "No media files were provided.");
    return outputs;
  },
};

export const avHandlers: ConversionHandler[] = [avHandler];
