import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Layers, Sparkles } from "lucide-react";
import { CATEGORIES, TOOLS, familyOf, getTool } from "@/lib/catalog";
import { isToolAvailable } from "@/server/convert/registry";
import { relatedTools } from "@/lib/search";
import { ConvertWorkspace } from "@/components/convert/ConvertWorkspace";
import { ToolCard } from "@/components/ToolCard";
import { FormatBadge } from "@/components/ui/Badge";
import { FormatFamilyIcon } from "@/components/icons";

interface Params {
  params: Promise<{ tool: string }>;
}

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: "Tool not found" };
  const inputLabel = tool.inputs.includes("*")
    ? "any file"
    : tool.inputs.map((e) => e.toUpperCase()).join(", ");
  const outputLabel = tool.output === "*" ? "its original files" : tool.output.toUpperCase();
  return {
    title: `${tool.name} — convert ${inputLabel} to ${outputLabel} online`,
    description: `${tool.description} Free, fast and secure conversion with no account required — upload, convert, download.`,
    alternates: { canonical: `/convert/${tool.id}` },
    openGraph: {
      title: `${tool.name} | NEXORA Convert`,
      description: tool.description,
    },
  };
}

function buildFaq(tool: ReturnType<typeof getTool>) {
  if (!tool) return [];
  const inputLabel = tool.inputs.includes("*")
    ? "files"
    : tool.inputs.map((e) => e.toUpperCase()).join(" / ");
  const outputLabel = tool.output === "*" ? "the files inside" : tool.output.toUpperCase();
  const faq = [
    {
      q: `How do I convert ${inputLabel} to ${outputLabel}?`,
      a: `Drop your ${inputLabel} file into the box above (or browse your device), adjust any options, then press Convert. When the conversion finishes, download the results directly — no account, no software.`,
    },
    {
      q: `Is the ${tool.name} conversion free?`,
      a: `Yes. Every conversion on NEXORA Convert is free to use with no sign-up, watermarks or file-count tricks.`,
    },
    {
      q: "Are my files stored or shared?",
      a: "Files are uploaded over HTTPS, processed by our conversion engine and deleted immediately afterwards. We never store your files or share them with anyone. Favorites and recent tools stay in your browser only.",
    },
  ];
  if (tool.batch || tool.multiInput) {
    faq.push({
      q: "Can I convert multiple files at once?",
      a: tool.multiInput
        ? "Yes — this tool accepts multiple input files in a single run, processed together in order."
        : "Yes — this tool supports batch conversion. Select several files and every one of them will be converted.",
    });
  }
  return faq;
}

export default async function ConvertToolPage({ params }: Params) {
  const { tool: slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  if (!(await isToolAvailable(tool))) notFound();

  const category = CATEGORIES.find((c) => c.id === tool.category);
  const related = relatedTools(tool, TOOLS, 4);
  const faq = buildFaq(tool);
  const inputExt = tool.inputs.includes("*") ? "any" : tool.inputs[0] ?? "";
  const iconFamily =
    tool.output === "*" || familyOf(tool.output) === "unknown" ? familyOf(inputExt) : familyOf(tool.output);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
        <Link href={`/category/${tool.category}`} className="transition-colors hover:text-foreground">
          {category?.label ?? "Tools"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
        <span aria-current="page" className="text-foreground">
          {tool.name}
        </span>
      </nav>

      <header className="mb-7 flex min-w-0 items-start gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-panel border border-border bg-card text-accent-soft sm:inline-flex">
          <FormatFamilyIcon family={iconFamily} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{tool.name}</h1>
            <FormatBadge from={inputExt} to={tool.output} />
          </div>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">{tool.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-faint">
            <span className="rounded-md border border-border bg-card px-2 py-1">{category?.label}</span>
            {tool.batch ? (
              <span className="rounded-md border border-border bg-card px-2 py-1">Batch conversion</span>
            ) : null}
            {tool.multiInput ? (
              <span className="rounded-md border border-border bg-card px-2 py-1">Multiple inputs</span>
            ) : null}
            <span className="rounded-md border border-border bg-card px-2 py-1">No account needed</span>
          </div>
        </div>
      </header>

      <ConvertWorkspace tool={tool} />

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="mb-4 text-lg font-semibold tracking-tight text-foreground">
            Related conversions
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((t) => (
              <li key={t.id} className="h-full">
                <ToolCard tool={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="faq-heading" className="mt-12 max-w-3xl">
        <h2
          id="faq-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
        >
          <Sparkles className="h-4.5 w-4.5 text-accent-soft" aria-hidden="true" />
          Frequently asked questions
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
          {faq.map((item) => (
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }),
          }}
        />
      </section>

      <p className="mt-10 flex items-center gap-2 text-sm text-faint">
        <Layers className="h-4 w-4" aria-hidden="true" />
        Looking for something else?{" "}
        <Link href="/tools" className="text-accent-soft underline-offset-4 hover:underline">
          Browse all tools
        </Link>
      </p>
    </div>
  );
}
