import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { getCapabilities } from "@/server/convert/capabilities";
import { makeAvif, makeGif, makeJpg, makePng, makeTiff, makeWebp, randomPixels, SVG_SAMPLE } from "./helpers";
import { expectConvertError, runTool } from "./run";

describe("image conversions (sharp)", () => {
  it("JPG → PNG preserves dimensions and produces a real PNG", async () => {
    const jpg = await makeJpg(80, 60);
    const [out] = await runTool("jpg-to-png", [{ name: "photo.jpg", data: jpg }]);
    expect(out!.name).toBe("photo.png");
    expect(out!.mime).toBe("image/png");
    const meta = await sharp(out!.data).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(80);
    expect(meta.height).toBe(60);
  });

  it("PNG → JPG honors the quality setting", async () => {
    const noisyPng = await sharp(randomPixels(200, 200), { raw: { width: 200, height: 200, channels: 3 } })
      .png()
      .toBuffer();
    const [low] = await runTool("png-to-jpg", [{ name: "a.png", data: noisyPng }], { quality: 30 });
    const [high] = await runTool("png-to-jpg", [{ name: "a.png", data: noisyPng }], { quality: 95 });
    expect(low!.data.length).toBeLessThan(high!.data.length);
    expect((await sharp(low!.data).metadata()).format).toBe("jpeg");
  });

  it("PNG → JPG clamps an insane quality value instead of failing", async () => {
    const png = await makePng();
    const [out] = await runTool("png-to-jpg", [{ name: "x.png", data: png }], { quality: "9999" });
    expect((await sharp(out!.data).metadata()).format).toBe("jpeg");
  });

  it("WEBP → PNG works", async () => {
    const webp = await makeWebp(40, 30);
    const [out] = await runTool("webp-to-png", [{ name: "img.webp", data: webp }]);
    const meta = await sharp(out!.data).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(40);
  });

  it("TIFF → JPG and AVIF → JPG work", async () => {
    const [t] = await runTool("tiff-to-jpg", [{ name: "scan.tiff", data: await makeTiff() }]);
    expect((await sharp(t!.data).metadata()).format).toBe("jpeg");
    const [a] = await runTool("avif-to-jpg", [{ name: "next.avif", data: await makeAvif() }]);
    expect((await sharp(a!.data).metadata()).format).toBe("jpeg");
  });

  it("SVG → PNG renders vectors and applies the scale setting", async () => {
    const [out] = await runTool("svg-to-png", [{ name: "logo.svg", data: SVG_SAMPLE }]);
    let meta = await sharp(out!.data).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(40);

    const [big] = await runTool("svg-to-png", [{ name: "logo.svg", data: SVG_SAMPLE }], { scale: 3 });
    meta = await sharp(big!.data).metadata();
    expect(meta.width).toBe(120);
    expect(big!.name).toBe("logo.png");
  });

  it("maxWidth resizes without enlarging small images", async () => {
    const jpg = await makeJpg(800, 600);
    const [out] = await runTool("jpg-to-png", [{ name: "big.jpg", data: jpg }], { maxWidth: 200 });
    const meta = await sharp(out!.data).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
    const [small] = await runTool("jpg-to-png", [{ name: "s.jpg", data: await makeJpg(50, 50) }], { maxWidth: 200 });
    expect((await sharp(small!.data).metadata()).width).toBe(50);
  });

  it("GIF → PNG (static) and GIF → WEBP work", async () => {
    const gif = await makeGif();
    const [png] = await runTool("gif-to-png", [{ name: "anim.gif", data: gif }]);
    expect((await sharp(png!.data).metadata()).format).toBe("png");
    const [webp] = await runTool("gif-to-webp", [{ name: "anim.gif", data: gif }]);
    expect((await sharp(webp!.data).metadata()).format).toBe("webp");
  });

  it("preserves animation for GIF → WEBP when the source is animated", async () => {
    const caps = await getCapabilities();
    if (!caps.ffmpeg) return; // fixture generation needs ffmpeg
    const { makeAnimatedGif } = await import("./helpers");
    const anim = await makeAnimatedGif();
    const [out] = await runTool("gif-to-webp", [{ name: "clip.gif", data: anim }]);
    const meta = await sharp(out!.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.pages ?? 1).toBeGreaterThan(1);
  });

  it("batch conversion keeps per-file results with unique names", async () => {
    const a = await makeJpg(10, 10);
    const b = await makeJpg(12, 12);
    const outs = await runTool("jpg-to-png", [
      { name: "photo.jpg", data: a },
      { name: "photo.jpg", data: b },
    ]);
    expect(outs).toHaveLength(2);
    expect(outs[0]!.name).toBe("photo.png");
    expect(outs[1]!.name).toBe("photo-2.png");
  });

  it("rejects corrupted image data with a useful message", async () => {
    const bad = Buffer.from("definitely not a jpeg, but named like one....", "utf8");
    const err = await expectConvertError(
      runTool("jpg-to-png", [{ name: "broken.jpg", data: bad }]),
      "invalid_file",
      "conversion_failed",
    );
    expect(err.message).toMatch(/broken\.jpg|image/i);
  });

  it("resize setting survives clamping (maxWidth 0 = keep original)", async () => {
    const jpg = await makeJpg(64, 48);
    const [out] = await runTool("jpg-to-png", [{ name: "orig.jpg", data: jpg }], { maxWidth: 0 });
    expect((await sharp(out!.data).metadata()).width).toBe(64);
  });
});
