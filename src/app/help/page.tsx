import type { Metadata } from "next";
import Link from "next/link";
import { getAvailableTools } from "@/server/convert/registry";
import { popularTools } from "@/lib/search";
import { FormatBadge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Help & FAQ — how NEXORA Convert works",
  description:
    "Answers about supported formats, file limits, privacy, batch conversion and troubleshooting on NEXORA Convert.",
  alternates: { canonical: "/help" },
};

const FAQ_GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "How does NEXORA Convert work?",
        a: "Find your conversion on the dashboard (search helps — try “JPG to PNG”), drop your file into the conversion page, press Convert, then download the result. No account is required for anything.",
      },
      {
        q: "Which formats are supported?",
        a: "Images (JPG, PNG, WEBP, GIF, TIFF, AVIF, SVG), PDF tools (create, render, extract text, merge, split), documents (DOCX ↔ TXT/Markdown/HTML), spreadsheets (CSV, XLSX, XLS, ODS, JSON), presentations (PPTX text extraction), audio (MP3, WAV, FLAC, OGG, M4A), video (MP4, WEBM, MOV, MKV, AVI) and archives (ZIP, TAR). Every tool listed on this site is implemented and tested — formats we cannot convert reliably are simply not offered.",
      },
      {
        q: "What does the Universal Converter do?",
        a: "Open “Upload a file”, drop any file, and we detect its format in your browser and list only the conversions that genuinely work for it. It stops you from heading down a dead end.",
      },
    ],
  },
  {
    title: "Files & limits",
    items: [
      {
        q: "Where are my files processed?",
        a: "On our server. Files are uploaded over HTTPS, converted by our engines, and deleted immediately after the request finishes. Audio and video conversions use a temporary folder that is wiped as soon as the conversion ends. Files are never stored, published or shared. (Favorites and recent searches are the exception — those live in your browser's local storage only.)",
      },
      {
        q: "What are the file size limits?",
        a: "Limits depend on the tool and are shown in the “Limits” panel on every conversion page — for example images accept up to 50 MB per file, PDFs up to 100 MB, and audio/video up to 250 MB, with 500 MB total per run.",
      },
      {
        q: "Can I convert several files at once?",
        a: "Yes — tools marked “Batch conversion” accept multiple files and convert each one independently, with a Download All button at the end. Tools like Merge PDF take several inputs and produce one combined file.",
      },
      {
        q: "Do I lose quality?",
        a: "Lossless targets (PNG, WAV, FLAC, TIFF) keep everything. Lossy targets (JPG, WEBP, MP3) expose a quality control so you decide the size/quality balance — the default of 90 is tuned for a great balance.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "My file failed to convert. Why?",
        a: "Usually one of three things: the file is corrupted, it is password-protected (remove the password first), or it is not really the format its name claims — we check file signatures, so a PNG renamed to .jpg is rejected with a clear message.",
      },
      {
        q: "“No selectable text was found” on a PDF.",
        a: "That PDF is a scan or image-only document. Text extraction needs selectable text — run OCR first, or use PDF to JPG/PNG to export the pages as images.",
      },
      {
        q: "A tool I expected is missing.",
        a: "We only list conversions we can actually run. Legacy binary formats (.doc, .ppt) and HEIC are not offered because no reliable engine is available in this deployment, and audio/video tools only appear when the media engine is installed.",
      },
    ],
  },
];

export default async function HelpPage() {
  const tools = await getAvailableTools();
  const popular = popularTools(tools, 6);
  const allQuestions = FAQ_GROUPS.flatMap((g) => g.items);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Help &amp; FAQ</h1>
      <p className="mt-2 max-w-2xl text-base text-muted">
        Everything worth knowing about converting files here — short, honest answers with no marketing fluff.
      </p>

      <div className="mt-8 space-y-10">
        {FAQ_GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`faq-${group.title.replace(/\s+/g, "-").toLowerCase()}`}>
            <h2
              id={`faq-${group.title.replace(/\s+/g, "-").toLowerCase()}`}
              className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint"
            >
              {group.title}
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
              {group.items.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                    <span className="flex items-start justify-between gap-4">
                      {item.q}
                      <span aria-hidden="true" className="mt-0.5 text-accent-soft transition-transform group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12" aria-labelledby="popular-help">
        <h2 id="popular-help" className="mb-3 text-lg font-semibold text-foreground">
          Jump to a popular conversion
        </h2>
        <ul className="flex flex-wrap gap-2.5">
          {popular.map((tool) => (
            <li key={tool.id}>
              <Link
                href={`/convert/${tool.id}`}
                className="inline-flex items-center gap-2 rounded-control border border-border bg-card px-3.5 py-2.5 text-sm text-foreground transition-colors hover:border-accent/50 hover:bg-elevated"
              >
                {tool.name}
                <FormatBadge
                  from={tool.inputs[0] ?? "?"}
                  to={tool.output}
                  className="border-0 bg-transparent px-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: allQuestions.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
