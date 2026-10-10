import { describe, expect, it } from "vitest";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { makeDocx, makeCsv, makeOds, makePptx, makeXls, makeXlsx } from "./helpers";
import { expectConvertError, runTool } from "./run";

describe("document conversions", () => {
  it("Word → TXT extracts the text", async () => {
    const docx = await makeDocx();
    const [out] = await runTool("docx-to-txt", [{ name: "report.docx", data: docx }]);
    expect(out!.name).toBe("report.txt");
    const text = out!.data.toString("utf8");
    expect(text).toContain("Quarterly Report");
    expect(text).toContain("Revenue grew by 14 percent.");
  });

  it("Word → Markdown keeps heading structure", async () => {
    const docx = await makeDocx();
    const [out] = await runTool("docx-to-md", [{ name: "report.docx", data: docx }]);
    expect(out!.name).toBe("report.md");
    expect(out!.mime).toContain("markdown");
    const md = out!.data.toString("utf8");
    expect(md).toMatch(/^# Quarterly Report/m);
    expect(md).toMatch(/^## Notes/m);
    expect(md).toContain("Revenue grew by 14 percent.");
  });

  it("Word → HTML produces a full HTML document", async () => {
    const docx = await makeDocx();
    const [out] = await runTool("docx-to-html", [{ name: "report.docx", data: docx }]);
    const html = out!.data.toString("utf8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<h1>Quarterly Report</h1>");
    expect(html).toContain("Revenue grew by 14 percent.");
  });

  it("TXT → Word creates a readable docx", async () => {
    const txt = Buffer.from("Line one.\nLine two.\n\nLine four.\n", "utf8");
    const [out] = await runTool("txt-to-docx", [{ name: "notes.txt", data: txt }]);
    expect(out!.name).toBe("notes.docx");
    const { value } = await mammoth.extractRawText({ buffer: out!.data });
    expect(value).toContain("Line one.");
    expect(value).toContain("Line four.");
  });

  it("Markdown → Word maps headings and bullets", async () => {
    const md = Buffer.from("# Big Title\n\nSome intro text.\n\n- first item\n- second item\n", "utf8");
    const [out] = await runTool("md-to-docx", [{ name: "readme.md", data: md }]);
    expect(out!.name).toBe("readme.docx");
    const xml = out!.data; // docx is a zip — unzip document.xml
    const AdmZip = (await import("adm-zip")).default;
    const docXml = new AdmZip(xml).readAsText("word/document.xml");
    expect(docXml).toContain("Big Title");
    expect(docXml).toContain("Heading1");
    expect(docXml).toContain("first item");
    const { value } = await mammoth.extractRawText({ buffer: out!.data });
    expect(value).toContain("Big Title");
    expect(value).toContain("second item");
  });

  it("rejects an invalid docx with a friendly message", async () => {
    const err = await expectConvertError(
      runTool("docx-to-txt", [{ name: "fake.docx", data: Buffer.from("not a zip at all") }]),
      "invalid_file",
      "conversion_failed",
    );
    expect(err.message).toContain("fake.docx");
  });

  it("batch docx conversion produces unique output names", async () => {
    const d = await makeDocx();
    const outs = await runTool("docx-to-txt", [
      { name: "a.docx", data: d },
      { name: "a.docx", data: d },
    ]);
    expect(outs.map((o) => o.name)).toEqual(["a.txt", "a-2.txt"]);
  });
});

describe("presentation conversions", () => {
  it("PPTX → TXT pulls the text of every slide", async () => {
    const pptx = makePptx(2);
    const [out] = await runTool("pptx-to-txt", [{ name: "deck.pptx", data: pptx }]);
    expect(out!.name).toBe("deck.txt");
    const text = out!.data.toString("utf8");
    expect(text).toContain("Slide 1");
    expect(text).toContain("Slide 2");
    expect(text).toContain("Quarterly Review");
    expect(text).toContain("Revenue up 28%");
  });

  it("rejects archives with no slides", async () => {
    const { makeZip } = await import("./helpers");
    const notPptx = makeZip([{ name: "random.txt", data: "hello" }]);
    const err = await expectConvertError(
      runTool("pptx-to-txt", [{ name: "deck.pptx", data: notPptx }]),
      "invalid_file",
    );
    expect(err.message).toMatch(/no slides/i);
  });
});

describe("spreadsheet conversions", () => {
  it("CSV → XLSX produces a real workbook", async () => {
    const [out] = await runTool("csv-to-xlsx", [{ name: "data.csv", data: makeCsv() }]);
    expect(out!.name).toBe("data.xlsx");
    const wb = XLSX.read(out!.data, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "widget", qty: 5 });
  });

  it("XLSX → CSV exports the first sheet with a UTF-8 BOM", async () => {
    const [out] = await runTool("xlsx-to-csv", [{ name: "data.xlsx", data: await makeXlsx() }]);
    expect(out!.mime).toBe("text/csv");
    const text = out!.data.toString("utf8");
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain("name,qty");
    expect(text).toContain("widget,5");
  });

  it("XLS → XLSX upgrades legacy workbooks", async () => {
    const [out] = await runTool("xls-to-xlsx", [{ name: "old.xls", data: await makeXls() }]);
    const wb = XLSX.read(out!.data, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!);
    expect(rows[0]).toMatchObject({ city: "Lima", pop: 10 });
  });

  it("ODS → XLSX and XLSX → ODS round-trip", async () => {
    const [toXlsx] = await runTool("ods-to-xlsx", [{ name: "calc.ods", data: await makeOds() }]);
    const wb = XLSX.read(toXlsx!.data, { type: "buffer" });
    expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!)).toHaveLength(1);

    const [toOds] = await runTool("xlsx-to-ods", [{ name: "data.xlsx", data: await makeXlsx() }]);
    expect(toOds!.name).toBe("data.ods");
    const back = XLSX.read(toOds!.data, { type: "buffer" });
    expect(XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]!]!)).toHaveLength(1);
  });

  it("CSV → JSON maps headers to keys", async () => {
    const [out] = await runTool("csv-to-json", [{ name: "data.csv", data: makeCsv() }]);
    expect(out!.mime).toBe("application/json");
    const rows = JSON.parse(out!.data.toString("utf8")) as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "widget", qty: 5 });
  });

  it("rejects empty and corrupt workbooks", async () => {
    const emptyErr = await expectConvertError(
      runTool("csv-to-xlsx", [{ name: "broken.csv", data: Buffer.from([]) }]),
      "invalid_file",
    );
    expect(emptyErr.message).toContain("empty");

    const corrupt = await expectConvertError(
      runTool("xlsx-to-csv", [
        { name: "corrupt.xlsx", data: Buffer.from("PK\u0003\u0004 but not really a zip archive at all") },
      ]),
      "invalid_file",
      "conversion_failed",
    );
    expect(corrupt.message).toContain("corrupt.xlsx");
  });
});
