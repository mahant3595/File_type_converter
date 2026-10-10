import os from "node:os";
import { describe, expect, it } from "vitest";
import { fileTypeFromBuffer } from "file-type";
import { getCapabilities } from "@/server/convert/capabilities";
import { makeMp3, makeMp4, makeWav } from "./helpers";
import { expectConvertError, runTool } from "./run";

const caps = await getCapabilities();
const maybe = caps.ffmpeg ? describe : describe.skip;

maybe("audio/video conversions (ffmpeg)", () => {
  it("WAV → MP3 produces a real MP3", async () => {
    const [out] = await runTool("wav-to-mp3", [{ name: "tone.wav", data: await makeWav() }], { bitrate: "192k" });
    expect(out!.name).toBe("tone.mp3");
    const ft = await fileTypeFromBuffer(out!.data);
    expect(ft?.ext).toBe("mp3");
    expect(out!.data.length).toBeGreaterThan(1000);
  });

  it("MP3 → WAV decodes back to PCM", async () => {
    const [out] = await runTool("mp3-to-wav", [{ name: "song.mp3", data: await makeMp3() }]);
    expect(out!.mime).toBe("audio/wav");
    const ft = await fileTypeFromBuffer(out!.data);
    expect(ft?.ext).toBe("wav");
    expect(out!.data.subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("WAV → FLAC produces lossless FLAC", async () => {
    const [out] = await runTool("wav-to-flac", [{ name: "tone.wav", data: await makeWav() }]);
    const ft = await fileTypeFromBuffer(out!.data);
    expect(ft?.ext).toBe("flac");
    expect(out!.data.subarray(0, 4).toString("ascii")).toBe("fLaC");
  });

  it("MP4 → MP3 extracts the audio track", async () => {
    const [out] = await runTool("mp4-to-mp3", [{ name: "clip.mp4", data: await makeMp4() }], { bitrate: "128k" });
    expect(out!.name).toBe("clip.mp3");
    const ft = await fileTypeFromBuffer(out!.data);
    expect(ft?.ext).toBe("mp3");
  });

  it("MP4 → WEBM transcodes video", async () => {
    const [out] = await runTool("mp4-to-webm", [{ name: "clip.mp4", data: await makeMp4() }], { crf: "38" });
    expect(out!.name).toBe("clip.webm");
    expect(out!.mime).toBe("video/webm");
    const ft = await fileTypeFromBuffer(out!.data);
    expect(ft?.ext).toBe("webm");
    expect(out!.data.length).toBeGreaterThan(500);
  });

  it("MP4 → GIF produces an animated image", async () => {
    const [out] = await runTool("mp4-to-gif", [{ name: "clip.mp4", data: await makeMp4() }], { fps: "8" });
    expect(out!.mime).toBe("image/gif");
    expect(out!.data.subarray(0, 3).toString("ascii")).toBe("GIF");
  });

  it("reports an honest error for undecodable media (no fake success, no paths)", async () => {
    const junk = Buffer.alloc(4096, 7);
    const err = await expectConvertError(
      runTool("mp4-to-mp3", [{ name: "fake.mp4", data: junk }]),
      "conversion_failed",
      "corrupt_file",
      "invalid_file",
    );
    expect(err.message).not.toContain(os.tmpdir());
    expect(err.message).not.toMatch(/\/tmp|ffmpeg|node_modules|Error:/);
    expect(err.message).toMatch(/fake\.mp4|corrupted|unsupported/i);
  });
});

describe.skipIf(caps.ffmpeg)("ffmpeg not installed", () => {
  it("audio/video tools are gated off", async () => {
    const { getAvailableTools } = await import("@/server/convert/registry");
    const available = await getAvailableTools();
    expect(available.some((t) => t.handler === "av")).toBe(false);
  });
});
