import { describe, expect, it } from "vitest";
import {
  extensionOf,
  formatBytes,
  isExtensionAllowed,
  parsePageRanges,
  sanitizeEntryPath,
  sanitizeFilename,
  stripExtension,
} from "@/lib/validate";

describe("filename sanitization", () => {
  it("strips directories and traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("_._etc_passwd");
    expect(sanitizeFilename("C:\\Windows\\system32\\cmd.exe")).toBe("C:_Windows_system32_cmd.exe");
    expect(sanitizeFilename("/absolute/path/file.png")).toBe("_absolute_path_file.png");
    expect(sanitizeFilename("..")).toBe("file");
    expect(sanitizeFilename("...")).toBe("file");
  });

  it("removes control characters and null bytes", () => {
    expect(sanitizeFilename("evil\u0000name\u0007.txt")).toBe("evilname.txt");
  });

  it("keeps normal names untouched", () => {
    expect(sanitizeFilename("My Report (final).pdf")).toBe("My Report (final).pdf");
    expect(sanitizeFilename("photo-01.jpg")).toBe("photo-01.jpg");
  });

  it("bounds very long names while preserving the extension", () => {
    const long = `${"a".repeat(400)}.png`;
    const out = sanitizeFilename(long);
    expect(out.length).toBeLessThanOrEqual(180);
    expect(out.endsWith(".png")).toBe(true);
  });

  it("never returns an empty name", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("   ")).toBe("file");
    expect(sanitizeFilename(".hidden", "fallback")).toBe("hidden");
  });
});

describe("extensions", () => {
  it("reads lowercase extensions", () => {
    expect(extensionOf("photo.JPG")).toBe("jpg");
    expect(extensionOf("a.tar.gz")).toBe("gz");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".bashrc")).toBe("");
    expect(extensionOf("trailing.")).toBe("");
  });

  it("strips extensions for output naming", () => {
    expect(stripExtension("photo.jpg")).toBe("photo");
    expect(stripExtension("archive.tar")).toBe("archive");
    expect(stripExtension("noext")).toBe("noext");
  });

  it("validates against the allowed list, honoring wildcard", () => {
    expect(isExtensionAllowed("a.png", ["jpg", "png"])).toBe(true);
    expect(isExtensionAllowed("a.gif", ["jpg", "png"])).toBe(false);
    expect(isExtensionAllowed("anything.bin", ["*"])).toBe(true);
  });
});

describe("page ranges", () => {
  it("defaults to all pages when empty", () => {
    expect(parsePageRanges("", 5)).toEqual([{ start: 1, end: 5 }]);
    expect(parsePageRanges("  ", 1)).toEqual([{ start: 1, end: 1 }]);
  });

  it("parses ranges and single pages", () => {
    expect(parsePageRanges("1-3, 7", 10)).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
    ]);
    expect(parsePageRanges("4-", 8)).toEqual([{ start: 4, end: 8 }]);
  });

  it("clamps ranges to the page count", () => {
    expect(parsePageRanges("1-99", 3)).toEqual([{ start: 1, end: 3 }]);
  });

  it("rejects invalid input with friendly messages", () => {
    expect(() => parsePageRanges("abc", 5)).toThrow(/Invalid page range/);
    expect(() => parsePageRanges("5-2", 5)).toThrow(/Start must not exceed/);
    expect(() => parsePageRanges("9-10", 5)).toThrow(/out of range/);
    expect(() => parsePageRanges("0", 5)).toThrow(/start at 1/);
  });
});

describe("archive entry paths", () => {
  it("keeps safe relative paths", () => {
    expect(sanitizeEntryPath("docs/readme.txt")).toBe("docs/readme.txt");
    expect(sanitizeEntryPath("./docs/readme.txt")).toBe("docs/readme.txt");
  });

  it("defuses traversal and absolute paths", () => {
    expect(sanitizeEntryPath("../../etc/passwd")).toBe("etc/passwd");
    expect(sanitizeEntryPath("/etc/passwd")).toBe("etc/passwd");
    expect(sanitizeEntryPath("C:\\Users\\x\\f.txt")).toBe("Users/x/f.txt");
    expect(sanitizeEntryPath("..\\..\\win.ini")).toBe("win.ini");
  });

  it("skips empty and absurd entries", () => {
    expect(sanitizeEntryPath("")).toBeNull();
    expect(sanitizeEntryPath("../..")).toBeNull();
    expect(sanitizeEntryPath(`${"a/".repeat(20)}f.txt`)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats human-readable sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(-1)).toBe("—");
  });
});
