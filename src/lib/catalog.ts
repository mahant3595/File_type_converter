/**
 * NEXORA Convert — tool catalog (pure data, isomorphic).
 *
 * Every tool listed here MUST be backed by a registered, tested conversion
 * handler (see src/server/convert). Availability is additionally gated by
 * runtime capabilities (e.g. ffmpeg) before tools reach the UI.
 */

export type CategoryId =
  | "images"
  | "pdf"
  | "documents"
  | "spreadsheets"
  | "presentations"
  | "audio"
  | "video"
  | "archives";

export type FormatFamily =
  | "image"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "audio"
  | "video"
  | "archive"
  | "text"
  | "unknown";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  /** Icon key resolved by the FormatIcon/CategoryIcon components. */
  icon: string;
  blurb: string;
}

export interface ToolSetting {
  key: string;
  label: string;
  type: "number" | "select" | "text";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue: string | number;
  hint?: string;
}

export interface ToolDef {
  /** URL slug, e.g. "jpg-to-png" */
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  /** Accepted source extensions (lowercase, no dot). */
  inputs: string[];
  /** Target extension (lowercase, no dot). */
  output: string;
  /** Default output MIME type; handlers may refine per produced file. */
  outputMime: string;
  /** Extra search keywords / common phrases. */
  keywords: string[];
  /** Rank in the Popular Conversions strip (1 = first). */
  popular?: number;
  /** Whether multiple independent input files may be selected. */
  batch: boolean;
  /** Whether the tool consumes several inputs to produce one output. */
  multiInput?: boolean;
  maxFiles?: number;
  settings?: ToolSetting[];
  handler: string;
  related?: string[];
}

export const PRODUCT = {
  name: "NEXORA Convert",
  tagline: "Every File. Any Format. One Simple Tool.",
  heroCopy:
    "Discover powerful file conversion tools for images, documents, PDFs, audio, and video. Get the format you need with a simple, secure, and intuitive workflow.",
} as const;

export const CATEGORIES: CategoryDef[] = [
  { id: "images", label: "Images", icon: "image", blurb: "Convert photos and graphics between JPG, PNG, WEBP, TIFF, AVIF, SVG and more." },
  { id: "pdf", label: "PDF Tools", icon: "pdf", blurb: "Create, render, extract, merge and split PDF documents." },
  { id: "documents", label: "Documents", icon: "document", blurb: "Move text content between Word documents, Markdown, HTML and plain text." },
  { id: "spreadsheets", label: "Spreadsheets", icon: "spreadsheet", blurb: "Convert CSV, XLSX, XLS and ODS workbooks — or export to JSON." },
  { id: "presentations", label: "Presentations", icon: "presentation", blurb: "Pull the text content out of PowerPoint decks." },
  { id: "audio", label: "Audio", icon: "audio", blurb: "Convert MP3, WAV, FLAC, OGG and M4A audio files." },
  { id: "video", label: "Video", icon: "video", blurb: "Convert MP4, WEBM, MOV, MKV and AVI video — including video to audio." },
  { id: "archives", label: "Archives", icon: "archive", blurb: "Create, convert and extract ZIP and TAR archives." },
];

/** File extension → display/family metadata (for icons and validation copy). */
export const FORMAT_FAMILY: Record<string, FormatFamily> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image",
  tif: "image", tiff: "image", avif: "image", svg: "image", bmp: "image",
  heic: "image", heif: "image", ico: "image",
  pdf: "pdf",
  docx: "document", doc: "document", odt: "document", rtf: "document",
  txt: "text", md: "text", markdown: "text", html: "text", htm: "text", csv: "text",
  xlsx: "spreadsheet", xls: "spreadsheet", ods: "spreadsheet",
  pptx: "presentation", ppt: "presentation",
  mp3: "audio", wav: "audio", aac: "audio", flac: "audio", ogg: "audio", m4a: "audio",
  mp4: "video", webm: "video", mov: "video", mkv: "video", avi: "video",
  zip: "archive", tar: "archive", gz: "archive", rar: "archive", "7z": "archive",
};

export function familyOf(ext: string): FormatFamily {
  return FORMAT_FAMILY[ext.toLowerCase()] ?? "unknown";
}

const QUALITY_SETTING: ToolSetting = {
  key: "quality",
  label: "Quality",
  type: "number",
  min: 1,
  max: 100,
  step: 1,
  defaultValue: 90,
  hint: "Higher is better quality and a larger file.",
};

const RESIZE_SETTING: ToolSetting = {
  key: "maxWidth",
  label: "Max width (px)",
  type: "number",
  min: 0,
  max: 10000,
  step: 1,
  defaultValue: 0,
  hint: "Leave at 0 to keep the original size.",
};

const IMAGE_OUTPUT_MIME: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", tiff: "image/tiff", gif: "image/gif",
};

function imageTool(
  id: string,
  inputs: string[],
  output: string,
  description: string,
  extra?: Partial<ToolDef>,
): ToolDef {
  const lossy = output === "jpg" || output === "webp" || output === "avif";
  return {
    id,
    name: id.split("-to-").map((p, i) => (i === 0 ? p.toUpperCase() : p.toUpperCase())).join(" to "),
    description,
    category: "images",
    inputs,
    output,
    outputMime: IMAGE_OUTPUT_MIME[output] ?? "application/octet-stream",
    keywords: [...inputs, output],
    batch: true,
    maxFiles: 20,
    settings: [...(lossy ? [QUALITY_SETTING] : []), RESIZE_SETTING],
    handler: "image",
    ...extra,
  };
}

/**
 * The single source of truth for what the product offers.
 * Handlers are bound in src/server/convert/registry.ts — a tool whose handler
 * is missing or unavailable is never rendered in the UI.
 */
export const TOOLS: ToolDef[] = [
  /* ------------------------------- images -------------------------------- */
  imageTool("jpg-to-png", ["jpg", "jpeg"], "png", "Convert JPEG images into lossless PNG files.", {
    keywords: ["jpeg", "jpg", "png", "photo", "picture", "transparent"],
    popular: 1,
    related: ["png-to-jpg", "webp-to-jpg", "jpg-to-webp"],
  }),
  imageTool("png-to-jpg", ["png"], "jpg", "Turn PNG images into compact, widely supported JPEG files.", {
    keywords: ["png", "jpg", "jpeg", "compress photo"],
    popular: 2,
    related: ["jpg-to-png", "png-to-webp", "jpg-to-pdf"],
  }),
  imageTool("webp-to-jpg", ["webp"], "jpg", "Convert modern WEBP images into universally supported JPEG files.", {
    keywords: ["webp", "jpg", "jpeg"],
    popular: 3,
    related: ["webp-to-png", "jpg-to-webp", "png-to-jpg"],
  }),
  imageTool("jpg-to-webp", ["jpg", "jpeg"], "webp", "Compress JPEG images into smaller, modern WEBP files.", {
    keywords: ["jpeg", "webp", "compress", "smaller"],
    related: ["png-to-webp", "jpg-to-png", "webp-to-jpg"],
  }),
  imageTool("png-to-webp", ["png"], "webp", "Recompress PNG graphics into lightweight WEBP images.", {
    keywords: ["webp", "compress", "smaller"],
    related: ["jpg-to-webp", "webp-to-png", "png-to-jpg"],
  }),
  imageTool("webp-to-png", ["webp"], "png", "Convert WEBP images into PNG files with full quality.", {
    keywords: ["webp", "png", "lossless"],
    related: ["webp-to-jpg", "png-to-jpg", "jpg-to-png"],
  }),
  imageTool("svg-to-png", ["svg"], "png", "Render SVG vector graphics into crisp PNG raster images.", {
    keywords: ["svg", "png", "vector", "raster", "logo", "icon"],
    settings: [
      { key: "scale", label: "Scale (×)", type: "number", min: 1, max: 16, step: 1, defaultValue: 1, hint: "Multiplies the vector size before rendering." },
    ],
    related: ["svg-to-jpg", "png-to-jpg"],
  }),
  imageTool("svg-to-jpg", ["svg"], "jpg", "Render SVG vector graphics into shareable JPEG images.", {
    keywords: ["svg", "jpg", "vector", "raster", "logo"],
    settings: [
      { key: "scale", label: "Scale (×)", type: "number", min: 1, max: 16, step: 1, defaultValue: 1, hint: "Multiplies the vector size before rendering." },
      QUALITY_SETTING,
    ],
    related: ["svg-to-png", "jpg-to-png"],
  }),
  imageTool("gif-to-png", ["gif"], "png", "Save the first frame of a GIF animation as a PNG image.", {
    keywords: ["gif", "png", "first frame", "static", "animation"],
    settings: [],
    related: ["gif-to-webp", "png-to-jpg"],
  }),
  imageTool("gif-to-webp", ["gif"], "webp", "Convert animated GIFs into compact animated WEBP files.", {
    keywords: ["gif", "webp", "animated", "animation"],
    settings: [],
    related: ["gif-to-png", "jpg-to-webp"],
  }),
  imageTool("tiff-to-jpg", ["tif", "tiff"], "jpg", "Convert high-quality TIFF scans into easy-to-share JPEG files.", {
    keywords: ["tiff", "tif", "scan", "jpg", "jpeg"],
    related: ["tiff-to-png", "jpg-to-png"],
  }),
  imageTool("tiff-to-png", ["tif", "tiff"], "png", "Convert TIFF images into PNG files without JPEG artifacts.", {
    keywords: ["tiff", "tif", "scan", "png"],
    related: ["tiff-to-jpg", "png-to-webp"],
  }),
  imageTool("avif-to-jpg", ["avif"], "jpg", "Convert next-gen AVIF images into universally supported JPEG files.", {
    keywords: ["avif", "jpg", "jpeg", "next gen"],
    related: ["avif-to-png", "webp-to-jpg"],
  }),
  imageTool("avif-to-png", ["avif"], "png", "Convert AVIF images into PNG files that older apps can open.", {
    keywords: ["avif", "png"],
    related: ["avif-to-jpg", "webp-to-png"],
  }),

  /* --------------------------------- pdf --------------------------------- */
  {
    id: "jpg-to-pdf", name: "JPG to PDF", category: "pdf",
    description: "Combine JPEG photos into a single, neatly sized PDF document.",
    inputs: ["jpg", "jpeg"], output: "pdf", outputMime: "application/pdf",
    keywords: ["jpeg", "pdf", "photo to pdf", "image to pdf", "pictures"],
    popular: 4, batch: false, multiInput: true, maxFiles: 30, handler: "image-to-pdf",
    settings: [
      { key: "pageSize", label: "Page size", type: "select", defaultValue: "fit",
        options: [{ value: "fit", label: "Fit image" }, { value: "a4", label: "A4 with margins" }] },
    ],
    related: ["png-to-pdf", "pdf-to-jpg", "pdf-to-word"],
  },
  {
    id: "png-to-pdf", name: "PNG to PDF", category: "pdf",
    description: "Bundle PNG graphics and screenshots into one clean PDF file.",
    inputs: ["png"], output: "pdf", outputMime: "application/pdf",
    keywords: ["png", "pdf", "image to pdf", "screenshot"],
    batch: false, multiInput: true, maxFiles: 30, handler: "image-to-pdf",
    settings: [
      { key: "pageSize", label: "Page size", type: "select", defaultValue: "fit",
        options: [{ value: "fit", label: "Fit image" }, { value: "a4", label: "A4 with margins" }] },
    ],
    related: ["jpg-to-pdf", "pdf-to-png"],
  },
  {
    id: "pdf-to-jpg", name: "PDF to JPG", category: "pdf",
    description: "Render every page of a PDF as a high-quality JPEG image.",
    inputs: ["pdf"], output: "jpg", outputMime: "image/jpeg",
    keywords: ["pdf", "jpg", "jpeg", "render", "page to image", "screenshot pdf"],
    popular: 5, batch: false, maxFiles: 1, handler: "pdf-render",
    settings: [
      { key: "dpi", label: "Resolution", type: "select", defaultValue: "150",
        options: [{ value: "72", label: "72 DPI — screen" }, { value: "150", label: "150 DPI — standard" }, { value: "300", label: "300 DPI — print" }] },
      { key: "pages", label: "Pages", type: "text", defaultValue: "", hint: "Leave empty for all pages, or e.g. 1-3, 7." },
    ],
    related: ["pdf-to-png", "jpg-to-pdf", "pdf-to-txt"],
  },
  {
    id: "pdf-to-png", name: "PDF to PNG", category: "pdf",
    description: "Export PDF pages as crisp PNG images, one file per page.",
    inputs: ["pdf"], output: "png", outputMime: "image/png",
    keywords: ["pdf", "png", "render", "page to image"],
    batch: false, maxFiles: 1, handler: "pdf-render",
    settings: [
      { key: "dpi", label: "Resolution", type: "select", defaultValue: "150",
        options: [{ value: "72", label: "72 DPI — screen" }, { value: "150", label: "150 DPI — standard" }, { value: "300", label: "300 DPI — print" }] },
      { key: "pages", label: "Pages", type: "text", defaultValue: "", hint: "Leave empty for all pages, or e.g. 1-3, 7." },
    ],
    related: ["pdf-to-jpg", "png-to-pdf", "pdf-to-txt"],
  },
  {
    id: "pdf-to-txt", name: "PDF to TXT", category: "pdf",
    description: "Extract the plain text of a PDF into an editable .txt file.",
    inputs: ["pdf"], output: "txt", outputMime: "text/plain",
    keywords: ["pdf", "txt", "text", "extract", "copy text", "plain text"],
    batch: false, maxFiles: 1, handler: "pdf-text",
    related: ["pdf-to-word", "pdf-to-docx", "docx-to-txt"],
  },
  {
    id: "pdf-to-word", name: "PDF to Word", category: "pdf",
    description: "Extract text from a PDF into an editable Word (.docx) document.",
    inputs: ["pdf"], output: "docx",
    outputMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    keywords: ["pdf", "word", "docx", "doc", "editable", "extract text"],
    popular: 6, batch: false, maxFiles: 1, handler: "pdf-to-docx",
    related: ["pdf-to-txt", "word-to-pdf", "docx-to-txt"],
  },
  {
    id: "merge-pdf", name: "Merge PDF", category: "pdf",
    description: "Combine several PDF documents into a single file, in order.",
    inputs: ["pdf"], output: "pdf", outputMime: "application/pdf",
    keywords: ["pdf", "merge", "combine", "join", "bundle", "multiple"],
    batch: false, multiInput: true, maxFiles: 30, handler: "pdf-merge",
    related: ["split-pdf", "pdf-to-jpg", "jpg-to-pdf"],
  },
  {
    id: "split-pdf", name: "Split PDF", category: "pdf",
    description: "Cut a PDF into separate files by page ranges.",
    inputs: ["pdf"], output: "pdf", outputMime: "application/pdf",
    keywords: ["pdf", "split", "pages", "cut", "extract pages", "separate"],
    batch: false, maxFiles: 1, handler: "pdf-split",
    settings: [
      { key: "ranges", label: "Page ranges", type: "text", defaultValue: "1-3, 4-6",
        hint: "One output file per range, e.g. 1-3, 4-6, 7." },
    ],
    related: ["merge-pdf", "pdf-to-jpg"],
  },

  /* ------------------------------ documents ------------------------------ */
  {
    id: "docx-to-txt", name: "Word to TXT", category: "documents",
    description: "Strip formatting from a Word document and keep its text.",
    inputs: ["docx"], output: "txt", outputMime: "text/plain",
    keywords: ["word", "docx", "txt", "text", "plain", "extract"],
    batch: true, maxFiles: 20, handler: "docx-convert",
    related: ["docx-to-md", "txt-to-docx", "pdf-to-txt"],
  },
  {
    id: "docx-to-md", name: "Word to Markdown", category: "documents",
    description: "Convert a Word document into clean, portable Markdown.",
    inputs: ["docx"], output: "md",
    outputMime: "text/markdown",
    keywords: ["word", "docx", "markdown", "md", "headings", "github"],
    batch: true, maxFiles: 20, handler: "docx-convert",
    related: ["docx-to-txt", "md-to-docx", "docx-to-html"],
  },
  {
    id: "docx-to-html", name: "Word to HTML", category: "documents",
    description: "Turn a Word document into semantic HTML for the web.",
    inputs: ["docx"], output: "html", outputMime: "text/html",
    keywords: ["word", "docx", "html", "web", "semantic"],
    batch: true, maxFiles: 20, handler: "docx-convert",
    related: ["docx-to-md", "docx-to-txt"],
  },
  {
    id: "txt-to-docx", name: "TXT to Word", category: "documents",
    description: "Wrap plain text into a formatted Word (.docx) document.",
    inputs: ["txt"], output: "docx",
    outputMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    keywords: ["txt", "text", "word", "docx", "doc"],
    batch: true, maxFiles: 20, handler: "text-to-docx",
    related: ["md-to-docx", "docx-to-txt"],
  },
  {
    id: "md-to-docx", name: "Markdown to Word", category: "documents",
    description: "Convert Markdown files into Word documents with real headings.",
    inputs: ["md", "markdown"], output: "docx",
    outputMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    keywords: ["markdown", "md", "word", "docx", "headings"],
    batch: true, maxFiles: 20, handler: "text-to-docx",
    related: ["txt-to-docx", "docx-to-md"],
  },

  /* ----------------------------- spreadsheets ---------------------------- */
  {
    id: "csv-to-xlsx", name: "CSV to XLSX", category: "spreadsheets",
    description: "Turn comma-separated values into a real Excel workbook.",
    inputs: ["csv"], output: "xlsx",
    outputMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    keywords: ["csv", "xlsx", "excel", "sheet", "table", "spreadsheet"],
    popular: 8, batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["xlsx-to-csv", "csv-to-json", "xls-to-xlsx"],
  },
  {
    id: "xlsx-to-csv", name: "XLSX to CSV", category: "spreadsheets",
    description: "Export the first sheet of an Excel workbook as CSV.",
    inputs: ["xlsx"], output: "csv", outputMime: "text/csv",
    keywords: ["xlsx", "excel", "csv", "export", "sheet"],
    batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["csv-to-xlsx", "xls-to-csv", "ods-to-xlsx"],
  },
  {
    id: "xls-to-xlsx", name: "XLS to XLSX", category: "spreadsheets",
    description: "Upgrade legacy .xls workbooks to the modern .xlsx format.",
    inputs: ["xls"], output: "xlsx",
    outputMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    keywords: ["xls", "xlsx", "excel", "legacy", "upgrade"],
    batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["xls-to-csv", "csv-to-xlsx"],
  },
  {
    id: "xls-to-csv", name: "XLS to CSV", category: "spreadsheets",
    description: "Extract plain CSV data from a legacy Excel workbook.",
    inputs: ["xls"], output: "csv", outputMime: "text/csv",
    keywords: ["xls", "csv", "excel", "legacy", "export"],
    batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["xls-to-xlsx", "xlsx-to-csv"],
  },
  {
    id: "ods-to-xlsx", name: "ODS to XLSX", category: "spreadsheets",
    description: "Convert OpenDocument spreadsheets into Excel workbooks.",
    inputs: ["ods"], output: "xlsx",
    outputMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    keywords: ["ods", "xlsx", "excel", "libreoffice", "opendocument"],
    batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["xlsx-to-ods", "csv-to-xlsx"],
  },
  {
    id: "xlsx-to-ods", name: "XLSX to ODS", category: "spreadsheets",
    description: "Export Excel workbooks to the open OpenDocument format.",
    inputs: ["xlsx"], output: "ods", outputMime: "application/vnd.oasis.opendocument.spreadsheet",
    keywords: ["xlsx", "ods", "opendocument", "libreoffice", "excel"],
    batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["ods-to-xlsx", "xlsx-to-csv"],
  },
  {
    id: "csv-to-json", name: "CSV to JSON", category: "spreadsheets",
    description: "Map CSV rows onto structured JSON objects with header keys.",
    inputs: ["csv"], output: "json", outputMime: "application/json",
    keywords: ["csv", "json", "data", "api", "rows"],
    batch: true, maxFiles: 20, handler: "sheet-convert",
    related: ["csv-to-xlsx", "xlsx-to-csv"],
  },

  /* ----------------------------- presentations --------------------------- */
  {
    id: "pptx-to-txt", name: "PPTX to TXT", category: "presentations",
    description: "Pull the text of every slide out of a PowerPoint file.",
    inputs: ["pptx"], output: "txt", outputMime: "text/plain",
    keywords: ["pptx", "powerpoint", "ppt", "slides", "text", "extract"],
    batch: true, maxFiles: 10, handler: "pptx-convert",
    related: ["docx-to-txt", "pdf-to-txt"],
  },

  /* -------------------------------- audio -------------------------------- */
  {
    id: "wav-to-mp3", name: "WAV to MP3", category: "audio",
    description: "Compress lossless WAV recordings into portable MP3 files.",
    inputs: ["wav"], output: "mp3", outputMime: "audio/mpeg",
    keywords: ["wav", "mp3", "compress", "audio", "music", "recording"],
    batch: true, maxFiles: 20, handler: "av",
    settings: [{ key: "bitrate", label: "Bitrate", type: "select", defaultValue: "192k",
      options: [{ value: "128k", label: "128 kbps — small" }, { value: "192k", label: "192 kbps — balanced" }, { value: "320k", label: "320 kbps — best" }] }],
    related: ["mp3-to-wav", "wav-to-flac", "flac-to-mp3"],
  },
  {
    id: "mp3-to-wav", name: "MP3 to WAV", category: "audio",
    description: "Decode MP3 files into uncompressed WAV audio for editing.",
    inputs: ["mp3"], output: "wav", outputMime: "audio/wav",
    keywords: ["mp3", "wav", "uncompressed", "edit", "audio"],
    batch: true, maxFiles: 20, handler: "av",
    related: ["wav-to-mp3", "flac-to-mp3", "wav-to-flac"],
  },
  {
    id: "flac-to-mp3", name: "FLAC to MP3", category: "audio",
    description: "Convert lossless FLAC music into smaller MP3 files.",
    inputs: ["flac"], output: "mp3", outputMime: "audio/mpeg",
    keywords: ["flac", "mp3", "lossless", "music", "compress"],
    batch: true, maxFiles: 20, handler: "av",
    settings: [{ key: "bitrate", label: "Bitrate", type: "select", defaultValue: "192k",
      options: [{ value: "128k", label: "128 kbps — small" }, { value: "192k", label: "192 kbps — balanced" }, { value: "320k", label: "320 kbps — best" }] }],
    related: ["wav-to-mp3", "wav-to-flac", "flac-to-mp3"],
  },
  {
    id: "ogg-to-mp3", name: "OGG to MP3", category: "audio",
    description: "Transcode OGG Vorbis audio into universally playable MP3.",
    inputs: ["ogg"], output: "mp3", outputMime: "audio/mpeg",
    keywords: ["ogg", "vorbis", "mp3", "audio", "transcode"],
    batch: true, maxFiles: 20, handler: "av",
    settings: [{ key: "bitrate", label: "Bitrate", type: "select", defaultValue: "192k",
      options: [{ value: "128k", label: "128 kbps — small" }, { value: "192k", label: "192 kbps — balanced" }, { value: "320k", label: "320 kbps — best" }] }],
    related: ["m4a-to-mp3", "flac-to-mp3", "mp3-to-wav"],
  },
  {
    id: "m4a-to-mp3", name: "M4A to MP3", category: "audio",
    description: "Convert iTunes/M4A audio files into simple MP3s.",
    inputs: ["m4a"], output: "mp3", outputMime: "audio/mpeg",
    keywords: ["m4a", "aac", "mp3", "itunes", "audio"],
    batch: true, maxFiles: 20, handler: "av",
    settings: [{ key: "bitrate", label: "Bitrate", type: "select", defaultValue: "192k",
      options: [{ value: "128k", label: "128 kbps — small" }, { value: "192k", label: "192 kbps — balanced" }, { value: "320k", label: "320 kbps — best" }] }],
    related: ["ogg-to-mp3", "wav-to-mp3"],
  },
  {
    id: "wav-to-flac", name: "WAV to FLAC", category: "audio",
    description: "Re-encode WAV audio into lossless, space-saving FLAC.",
    inputs: ["wav"], output: "flac", outputMime: "audio/flac",
    keywords: ["wav", "flac", "lossless", "archive", "audio"],
    batch: true, maxFiles: 20, handler: "av",
    related: ["wav-to-mp3", "flac-to-mp3"],
  },

  /* -------------------------------- video -------------------------------- */
  {
    id: "mp4-to-mp3", name: "MP4 to MP3", category: "video",
    description: "Extract the audio track from an MP4 video as an MP3 file.",
    inputs: ["mp4"], output: "mp3", outputMime: "audio/mpeg",
    keywords: ["mp4", "mp3", "extract audio", "rip audio", "video to audio", "music"],
    popular: 7, batch: true, maxFiles: 10, handler: "av",
    settings: [{ key: "bitrate", label: "Bitrate", type: "select", defaultValue: "192k",
      options: [{ value: "128k", label: "128 kbps — small" }, { value: "192k", label: "192 kbps — balanced" }, { value: "320k", label: "320 kbps — best" }] }],
    related: ["mp4-to-webm", "mp4-to-gif", "wav-to-mp3"],
  },
  {
    id: "mp4-to-webm", name: "MP4 to WEBM", category: "video",
    description: "Transcode MP4 video into web-friendly WEBM (VP9).",
    inputs: ["mp4"], output: "webm", outputMime: "video/webm",
    keywords: ["mp4", "webm", "vp9", "web", "transcode", "video"],
    batch: true, maxFiles: 5, handler: "av",
    settings: [{ key: "crf", label: "Quality (CRF)", type: "select", defaultValue: "32",
      options: [{ value: "28", label: "28 — higher quality" }, { value: "32", label: "32 — balanced" }, { value: "38", label: "38 — smaller file" }] }],
    related: ["webm-to-mp4", "mp4-to-gif", "mp4-to-mp3"],
  },
  {
    id: "mp4-to-gif", name: "MP4 to GIF", category: "video",
    description: "Turn a short MP4 clip into an animated GIF.",
    inputs: ["mp4"], output: "gif", outputMime: "image/gif",
    keywords: ["mp4", "gif", "animation", "clip", "meme"],
    batch: true, maxFiles: 5, handler: "av",
    settings: [{ key: "fps", label: "Frame rate", type: "select", defaultValue: "12",
      options: [{ value: "8", label: "8 fps — small" }, { value: "12", label: "12 fps — smooth" }, { value: "15", label: "15 fps — fluid" }] }],
    related: ["mp4-to-webm", "mp4-to-mp3", "gif-to-webp"],
  },
  {
    id: "webm-to-mp4", name: "WEBM to MP4", category: "video",
    description: "Convert WEBM recordings into universally playable MP4 files.",
    inputs: ["webm"], output: "mp4", outputMime: "video/mp4",
    keywords: ["webm", "mp4", "h264", "playback", "video"],
    batch: true, maxFiles: 5, handler: "av",
    related: ["mp4-to-webm", "mkv-to-mp4", "mov-to-mp4"],
  },
  {
    id: "mov-to-mp4", name: "MOV to MP4", category: "video",
    description: "Rewrap and compress QuickTime MOV video into MP4.",
    inputs: ["mov"], output: "mp4", outputMime: "video/mp4",
    keywords: ["mov", "quicktime", "mp4", "iphone", "video"],
    batch: true, maxFiles: 5, handler: "av",
    related: ["mkv-to-mp4", "avi-to-mp4", "mp4-to-webm"],
  },
  {
    id: "mkv-to-mp4", name: "MKV to MP4", category: "video",
    description: "Convert Matroska MKV files into lightweight MP4 videos.",
    inputs: ["mkv"], output: "mp4", outputMime: "video/mp4",
    keywords: ["mkv", "matroska", "mp4", "video"],
    batch: true, maxFiles: 5, handler: "av",
    related: ["avi-to-mp4", "mov-to-mp4", "mp4-to-webm"],
  },
  {
    id: "avi-to-mp4", name: "AVI to MP4", category: "video",
    description: "Modernize old AVI video into compact, shareable MP4.",
    inputs: ["avi"], output: "mp4", outputMime: "video/mp4",
    keywords: ["avi", "mp4", "legacy", "video", "compress"],
    batch: true, maxFiles: 5, handler: "av",
    related: ["mkv-to-mp4", "mov-to-mp4"],
  },

  /* ------------------------------- archives ------------------------------ */
  {
    id: "files-to-zip", name: "Files to ZIP", category: "archives",
    description: "Bundle any group of files into a single ZIP archive.",
    inputs: ["*"], output: "zip", outputMime: "application/zip",
    keywords: ["zip", "archive", "bundle", "pack", "compress", "multiple files"],
    batch: false, multiInput: true, maxFiles: 100, handler: "archive-create",
    related: ["zip-to-tar", "extract-zip", "files-to-tar"],
  },
  {
    id: "files-to-tar", name: "Files to TAR", category: "archives",
    description: "Pack files into an uncompressed TAR archive.",
    inputs: ["*"], output: "tar", outputMime: "application/x-tar",
    keywords: ["tar", "archive", "pack", "unix", "bundle"],
    batch: false, multiInput: true, maxFiles: 100, handler: "archive-create",
    related: ["files-to-zip", "tar-to-zip", "extract-tar"],
  },
  {
    id: "zip-to-tar", name: "ZIP to TAR", category: "archives",
    description: "Repack the contents of a ZIP archive into a TAR file.",
    inputs: ["zip"], output: "tar", outputMime: "application/x-tar",
    keywords: ["zip", "tar", "convert", "archive", "repack"],
    batch: true, maxFiles: 10, handler: "archive-convert",
    related: ["tar-to-zip", "extract-zip"],
  },
  {
    id: "tar-to-zip", name: "TAR to ZIP", category: "archives",
    description: "Convert a TAR archive into a compressed ZIP file.",
    inputs: ["tar"], output: "zip", outputMime: "application/zip",
    keywords: ["tar", "zip", "convert", "archive", "compress"],
    batch: true, maxFiles: 10, handler: "archive-convert",
    related: ["zip-to-tar", "extract-tar"],
  },
  {
    id: "extract-zip", name: "Extract ZIP", category: "archives",
    description: "Unzip an archive and download every file inside it.",
    inputs: ["zip"], output: "*",
    outputMime: "application/octet-stream",
    keywords: ["zip", "unzip", "extract", "unpack", "open archive"],
    batch: false, maxFiles: 1, handler: "archive-extract",
    related: ["extract-tar", "zip-to-tar", "files-to-zip"],
  },
  {
    id: "extract-tar", name: "Extract TAR", category: "archives",
    description: "Unpack a TAR archive and download its contents.",
    inputs: ["tar"], output: "*",
    outputMime: "application/octet-stream",
    keywords: ["tar", "extract", "unpack", "open archive"],
    batch: false, maxFiles: 1, handler: "archive-extract",
    related: ["extract-zip", "tar-to-zip"],
  },
];

export const TOOL_MAP: ReadonlyMap<string, ToolDef> = new Map(TOOLS.map((t) => [t.id, t]));

export function getTool(id: string | undefined | null): ToolDef | undefined {
  return id ? TOOL_MAP.get(id) : undefined;
}

export function categoryById(id: CategoryId): CategoryDef {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

/** Apply catalog defaults + coerce provided values (pure; used client and server). */
export function resolveOptions(tool: ToolDef, raw: Record<string, unknown> | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const s of tool.settings ?? []) out[s.key] = s.defaultValue;
  if (raw) {
    for (const s of tool.settings ?? []) {
      const v = raw[s.key];
      if (v === undefined || v === null || v === "") continue;
      if (s.type === "number") {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        const clamped = Math.min(s.max ?? n, Math.max(s.min ?? n, n));
        out[s.key] = Math.round(clamped);
      } else {
        const str = String(v);
        if (s.options && !s.options.some((o) => o.value === str)) continue;
        out[s.key] = str;
      }
    }
  }
  return out;
}
