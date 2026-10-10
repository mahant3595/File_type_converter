import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import { makeJpg, makePdfBlank, makePdfWithText, makePng } from "./helpers";
import { expectConvertError, runTool } from "./run";

describe("PDF conversions", () => {
  it("JPG → PDF creates one page per image sized to the image", async () => {
    const jpg = await makeJpg(80, 60);
    const png = await makePng(40, 100);
    const [out] = await runTool("jpg-to-pdf", [
      { name: "a.jpg", data: jpg },
      { name: "b.png", data: png },
    ]);
    expect(out!.name).toBe("a.pdf");
    expect(out!.mime).toBe("application/pdf");
    const doc = await PDFDocument.load(out!.data);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBe(80);
    expect(doc.getPage(0).getHeight()).toBe(60);
    expect(doc.getPage(1).getWidth()).toBe(40);
  });

  it("JPG → PDF A4 option creates A4 pages with margins", async () => {
    const jpg = await makeJpg(800, 600);
    const [out] = await runTool("jpg-to-pdf", [{ name: "photo.jpg", data: jpg }], { pageSize: "a4" });
    const doc = await PDFDocument.load(out!.data);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(Math.round(doc.getPage(0).getHeight())).toBe(842);
  });

  it("PDF → JPG renders every page at the requested DPI with visible content", async () => {
    const pdf = await makePdfWithText(2);
    const outs = await runTool("pdf-to-jpg", [{ name: "report.pdf", data: pdf }], { dpi: "72" });
    expect(outs).toHaveLength(2);
    expect(outs[0]!.name).toBe("report-page-1.jpg");
    const meta = await sharp(outs[0]!.data).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(300); // 300pt page at 72dpi

    // The text and the line must actually rasterize (font pipeline works).
    const { data, info } = await sharp(outs[0]!.data).greyscale().raw().toBuffer({ resolveWithObject: true });
    let dark = 0;
    for (const px of data) if (px < 200) dark += 1;
    expect(dark).toBeGreaterThan(30);
    expect(info.width).toBe(300);
  });

  it("PDF → JPG honors the pages filter", async () => {
    const pdf = await makePdfWithText(3);
    const outs = await runTool("pdf-to-jpg", [{ name: "r.pdf", data: pdf }], { dpi: "72", pages: "2-3" });
    expect(outs.map((o) => o.name)).toEqual(["r-page-2.jpg", "r-page-3.jpg"]);
  });

  it("PDF → PNG produces PNG pages at 150 DPI default", async () => {
    const pdf = await makePdfWithText(1);
    const [out] = await runTool("pdf-to-png", [{ name: "one.pdf", data: pdf }]);
    const meta = await sharp(out!.data).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(625); // 300pt * 150/72 ≈ 625
  });

  it("PDF → TXT extracts real text", async () => {
    const pdf = await makePdfWithText(2);
    const [out] = await runTool("pdf-to-txt", [{ name: "report.pdf", data: pdf }]);
    expect(out!.name).toBe("report.txt");
    const text = out!.data.toString("utf8");
    expect(text).toContain("HELLO NEXORA PAGE 1");
    expect(text).toContain("HELLO NEXORA PAGE 2");
  });

  it("PDF → Word produces a valid .docx containing the extracted text", async () => {
    const pdf = await makePdfWithText(2);
    const [out] = await runTool("pdf-to-word", [{ name: "report.pdf", data: pdf }]);
    expect(out!.name).toBe("report.docx");
    expect(out!.mime).toContain("wordprocessingml");
    const { value } = await mammoth.extractRawText({ buffer: out!.data });
    expect(value).toContain("HELLO NEXORA PAGE 1");
    expect(value).toContain("HELLO NEXORA PAGE 2");
  });

  it("Merge PDF combines pages in order", async () => {
    const two = await makePdfBlank(2);
    const three = await makePdfBlank(3);
    const [out] = await runTool("merge-pdf", [
      { name: "first.pdf", data: two },
      { name: "second.pdf", data: three },
    ]);
    expect(out!.name).toBe("merged.pdf");
    const doc = await PDFDocument.load(out!.data);
    expect(doc.getPageCount()).toBe(5);
  });

  it("Merge PDF refuses a single input", async () => {
    const one = await makePdfBlank(1);
    const err = await expectConvertError(
      runTool("merge-pdf", [{ name: "only.pdf", data: one }]),
      "invalid_file",
    );
    expect(err.message).toMatch(/at least two/i);
  });

  it("Split PDF produces one file per range", async () => {
    const pdf = await makePdfBlank(4);
    const outs = await runTool("split-pdf", [{ name: "book.pdf", data: pdf }], { ranges: "1-2, 3-4" });
    expect(outs).toHaveLength(2);
    expect(outs[0]!.name).toBe("book-pages-1-2.pdf");
    expect(outs[1]!.name).toBe("book-pages-3-4.pdf");
    expect((await PDFDocument.load(outs[0]!.data)).getPageCount()).toBe(2);
    expect((await PDFDocument.load(outs[1]!.data)).getPageCount()).toBe(2);
  });

  it("Split PDF validates page ranges", async () => {
    const pdf = await makePdfBlank(3);
    const err = await expectConvertError(
      runTool("split-pdf", [{ name: "b.pdf", data: pdf }], { ranges: "9-10" }),
      "invalid_file",
      "conversion_failed",
    );
    expect(err.message).toMatch(/out of range|Invalid/i);
  });

  it("rejects a corrupt PDF instead of pretending success", async () => {
    const garbage = Buffer.from("%PDF-1.7 this is not really a pdf structure at all...".repeat(4), "utf8");
    const err = await expectConvertError(
      runTool("pdf-to-txt", [{ name: "broken.pdf", data: garbage }]),
      "corrupt_file",
      "conversion_failed",
      "invalid_file",
    );
    expect(err.message.length).toBeGreaterThan(10);
  });

  it("reports the friendly error for a non-PDF payload", async () => {
    const err = await expectConvertError(
      runTool("pdf-to-jpg", [{ name: "fake.pdf", data: Buffer.from("hello world, definitely text") }]),
      "corrupt_file",
      "conversion_failed",
      "invalid_file",
    );
    expect(err.message).not.toMatch(/\/tmp|node_modules|at Object|undefined/);
  });
});
