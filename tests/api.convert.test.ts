import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { POST, GET } from "@/app/api/convert/route";
import { makeJpg, makeM4vBrandM4a, makeOggOpus, makePdfWithText, makePng, makeXls } from "./helpers";

interface ApiResult {
  status: number;
  json: { outputs?: { name: string; mime: string; size: number; data: string }[]; error?: { code: string; message: string } };
}

async function callPost(form: FormData): Promise<ApiResult> {
  const req = new Request("http://localhost/api/convert", {
    method: "POST",
    body: form,
    duplex: "half",
  } as RequestInit & { duplex?: "half" });
  const res = await POST(req as unknown as NextRequest);
  return { status: res.status, json: (await res.json()) as ApiResult["json"] };
}

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

/** Node Buffers need a widening cast to satisfy DOM File typings. */
function toBlob(b: Buffer | Uint8Array): BlobPart {
  return b as unknown as BlobPart;
}

describe("POST /api/convert", () => {
  it("converts a real JPG to PNG and returns base64 output", async () => {
    const form = new FormData();
    form.set("tool", "jpg-to-png");
    form.append("files", new File([toBlob(await makeJpg(64, 48))], "photo.jpg", { type: "image/jpeg" }));
    const res = await callPost(form);
    expect(res.status).toBe(200);
    expect(res.json.outputs).toHaveLength(1);
    const out = res.json.outputs![0]!;
    expect(out.name).toBe("photo.png");
    expect(out.mime).toBe("image/png");
    const buf = base64ToBuffer(out.data);
    expect((await fileTypeFromBuffer(buf))?.ext).toBe("png");
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(64);
  });

  it("applies declared options from the options field", async () => {
    const form = new FormData();
    form.set("tool", "svg-to-png");
    form.set("options", JSON.stringify({ scale: 2, bogusKey: "ignored" }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`;
    form.append("files", new File([toBlob(Buffer.from(svg))], "logo.svg", { type: "image/svg+xml" }));
    const res = await callPost(form);
    expect(res.status).toBe(200);
    const buf = base64ToBuffer(res.json.outputs![0]!.data);
    expect((await sharp(buf).metadata()).width).toBe(20);
  });

  it("rejects unknown tools with 404", async () => {
    const form = new FormData();
    form.set("tool", "heic-to-jpg");
    form.append("files", new File([toBlob(Buffer.from("x"))], "a.jpg"));
    const res = await callPost(form);
    expect(res.status).toBe(404);
    expect(res.json.error?.code).toBe("unknown_tool");
  });

  it("rejects files whose extension the tool does not accept", async () => {
    const form = new FormData();
    form.set("tool", "jpg-to-png");
    form.append("files", new File([toBlob(Buffer.from("plain text here"))], "notes.txt"));
    const res = await callPost(form);
    expect(res.status).toBe(422);
    expect(res.json.error?.code).toBe("invalid_file");
    expect(res.json.error?.message).toMatch(/accepts JPG/i);
  });

  it("rejects files whose content does not match their extension (magic bytes)", async () => {
    const form = new FormData();
    form.set("tool", "jpg-to-png");
    const pngBytes = await makePng(8, 8);
    form.append("files", new File([toBlob(pngBytes)], "lying.jpg", { type: "image/jpeg" }));
    const res = await callPost(form);
    expect(res.status).toBe(422);
    expect(res.json.error?.code).toBe("invalid_file");
    expect(res.json.error?.message).toMatch(/contains PNG data/i);
  });

  it("accepts real-world container variants whose sniff differs from the declared extension", async () => {
    // Legacy .xls is an OLE2 compound file → sniffs as "cfb".
    const xlsForm = new FormData();
    xlsForm.set("tool", "xls-to-xlsx");
    xlsForm.append("files", new File([toBlob(await makeXls())], "cities.xls", { type: "application/vnd.ms-excel" }));
    const xlsRes = await callPost(xlsForm);
    expect(xlsRes.status).toBe(200);
    expect(["zip", "xlsx"]).toContain((await fileTypeFromBuffer(base64ToBuffer(xlsRes.json.outputs![0]!.data)))?.ext);

    // Opus audio in an Ogg container → sniffs as "opus" but is a valid .ogg input.
    const oggForm = new FormData();
    oggForm.set("tool", "ogg-to-mp3");
    oggForm.append("files", new File([toBlob(await makeOggOpus())], "tone.ogg", { type: "audio/ogg" }));
    const oggRes = await callPost(oggForm);
    expect(oggRes.status).toBe(200);
    expect(oggRes.json.outputs![0]!.name).toBe("tone.mp3");

    // M4A written with the ipod brand → sniffs as "m4v" but is a valid .m4a input.
    const m4aForm = new FormData();
    m4aForm.set("tool", "m4a-to-mp3");
    m4aForm.append("files", new File([toBlob(await makeM4vBrandM4a())], "clip.m4a", { type: "audio/mp4" }));
    const m4aRes = await callPost(m4aForm);
    expect(m4aRes.status).toBe(200);
    expect(m4aRes.json.outputs![0]!.name).toBe("clip.mp3");
  });

  it("rejects requests with no files", async () => {
    const form = new FormData();
    form.set("tool", "jpg-to-png");
    const res = await callPost(form);
    expect(res.status).toBe(400);
    expect(res.json.error?.code).toBe("invalid_request");
  });

  it("rejects oversized files with 413 before processing", async () => {
    const form = new FormData();
    form.set("tool", "jpg-to-png");
    const big = new Uint8Array(51 * 1024 * 1024); // above the 50 MB image limit
    form.append("files", new File([toBlob(big)], "huge.jpg"));
    const res = await callPost(form);
    expect(res.status).toBe(413);
    expect(res.json.error?.code).toBe("too_large");
    expect(res.json.error?.message).toMatch(/50 MB/);
  });

  it("enforces per-tool file count limits (single-file tools)", async () => {
    const pdf = await makePdfWithText(2);
    const form = new FormData();
    form.set("tool", "pdf-to-jpg");
    form.append("files", new File([toBlob(pdf)], "a.pdf"));
    form.append("files", new File([toBlob(pdf)], "b.pdf"));
    const res = await callPost(form);
    expect(res.status).toBe(413);
    expect(res.json.error?.code).toBe("too_many_files");
  });

  it("rejects malformed options JSON", async () => {
    const form = new FormData();
    form.set("tool", "jpg-to-png");
    form.set("options", "{not json");
    form.append("files", new File([toBlob(await makeJpg())], "a.jpg"));
    const res = await callPost(form);
    expect(res.status).toBe(400);
    expect(res.json.error?.code).toBe("invalid_request");
  });

  it("returns a safe error for corrupted inputs without leaking internals", async () => {
    const form = new FormData();
    form.set("tool", "pdf-to-txt");
    form.append("files", new File([toBlob(Buffer.from("%PDF-1.7 garbage garbage garbage"))], "broken.pdf"));
    const res = await callPost(form);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const message = res.json.error?.message ?? "";
    expect(message).not.toMatch(/\/tmp|node_modules|workspace|at \w+\.|undefined|ENOENT/);
    expect(message.length).toBeGreaterThan(10);
  });

  it("GET is not a conversion endpoint", async () => {
    const res = GET();
    expect(res.status).toBe(400);
  });
});
