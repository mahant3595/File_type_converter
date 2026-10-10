import * as XLSX from "xlsx";
import type { ConversionHandler } from "../types";
import { ConvertError, toConvertError } from "../errors";
import { stripExtension } from "@/lib/validate";

/** CSV / XLSX / XLS / ODS ↔ CSV / XLSX / ODS / JSON (SheetJS). */
const sheetConvert: ConversionHandler = {
  id: "sheet-convert",
  maxBytesPerFile: 30 * 1024 * 1024,
  maxFiles: 20,
  async run({ tool, files }) {
    const outputs = [];
    const used = new Set<string>();
    const outExt = tool.output;

    for (const file of files) {
      if (file.data.length === 0) {
        throw new ConvertError("invalid_file", `"${file.name}" is empty.`);
      }
      let workbook: XLSX.WorkBook;
      try {
        const isTextish = /\.(csv|txt|tsv)$/i.test(file.name);
        workbook = isTextish
          ? XLSX.read(file.data.toString("utf8"), { type: "string" })
          : XLSX.read(file.data, { type: "buffer", cellDates: true });
      } catch (e) {
        throw toConvertError(e, `"${file.name}" is not a valid spreadsheet, or it is damaged.`);
      }

      const firstSheet = workbook.SheetNames[0];
      const sheet = firstSheet ? workbook.Sheets[firstSheet] : undefined;
      let data: Buffer;
      let mime = tool.outputMime;

      if (outExt === "csv") {
        if (!sheet) throw new ConvertError("conversion_failed", `"${file.name}" has no sheets.`);
        const csv = XLSX.utils.sheet_to_csv(sheet);
        data = Buffer.from("\uFEFF" + csv, "utf8");
        mime = "text/csv";
      } else if (outExt === "json") {
        if (!sheet) throw new ConvertError("conversion_failed", `"${file.name}" has no sheets.`);
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, blankrows: false });
        data = Buffer.from(JSON.stringify(rows, null, 2) + "\n", "utf8");
        mime = "application/json";
      } else {
        try {
          const bookType = outExt === "ods" ? "ods" : outExt === "xls" ? "biff8" : "xlsx";
          data = Buffer.from(
            XLSX.write(workbook, { type: "buffer", bookType: bookType as XLSX.BookType }),
          );
        } catch (e) {
          throw toConvertError(e, `"${file.name}" could not be exported to .${outExt}.`);
        }
      }

      let name = `${stripExtension(file.name)}.${outExt}`;
      if (used.has(name.toLowerCase())) name = `${stripExtension(file.name)}-${used.size + 1}.${outExt}`;
      used.add(name.toLowerCase());
      outputs.push({ name, mime, data });
    }
    if (outputs.length === 0) throw new ConvertError("invalid_file", "No spreadsheet files were provided.");
    return outputs;
  },
};

export const sheetHandlers: ConversionHandler[] = [sheetConvert];
