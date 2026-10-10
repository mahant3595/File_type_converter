import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { getAvailableTools } from "@/server/convert/registry";
import { categoryCounts } from "@/lib/search";
import { ToolExplorer } from "@/components/ToolExplorer";

const MERGED_SLUGS = ["audio-video"] as const;
const SLUGS = [...CATEGORIES.map((c) => c.id), ...MERGED_SLUGS];

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if ((SLUGS as readonly string[]).includes(slug)) {
    if ((MERGED_SLUGS as readonly string[]).includes(slug)) {
      return {
        title: "Audio & Video Tools — convert MP4, MP3, WAV, WEBM and more",
        description:
          "Convert audio and video files: MP4 to MP3, MP4 to WEBM, WAV to MP3, MOV to MP4, MKV to MP4 and more.",
        alternates: { canonical: `/category/${slug}` },
      };
    }
    const cat = CATEGORIES.find((c) => c.id === slug)!;
    return {
      title: `${cat.label} Conversion Tools`,
      description: cat.blurb,
      alternates: { canonical: `/category/${slug}` },
    };
  }
  return { title: "Category not found" };
}

export default async function CategoryPage({ params }: Params) {
  const { slug } = await params;
  const isMerged = (MERGED_SLUGS as readonly string[]).includes(slug);
  const category = CATEGORIES.find((c) => c.id === slug);
  if (!category && !isMerged) notFound();

  const tools = await getAvailableTools();
  const counts = categoryCounts(tools);

  const merged = isMerged;
  const subset = merged ? tools.filter((t) => t.category === "audio" || t.category === "video") : tools;
  const heading = merged ? "Audio & Video Tools" : `${category!.label} Tools`;
  const blurb = merged
    ? "Convert between audio and video formats — including extracting audio from video."
    : category!.blurb;
  const total = merged ? subset.length : counts[slug as CategoryId] ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
        <Link href="/tools" className="transition-colors hover:text-foreground">
          All Tools
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
        <span aria-current="page" className="text-foreground">
          {heading}
        </span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{heading}</h1>
      <p className="mt-2 max-w-2xl text-base text-muted">{blurb}</p>
      <p className="mt-1 text-sm text-faint">{total} working tool{total === 1 ? "" : "s"}</p>

      <div className="mt-8">
        <ToolExplorer
          tools={subset}
          initialCategory={merged ? "all" : (slug as CategoryId)}
          showSearch
          showTabs={!merged}
        />
      </div>
    </div>
  );
}
