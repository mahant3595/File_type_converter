import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SearchCheck, MousePointerClick, PackageCheck } from "lucide-react";
import { getAvailableTools } from "@/server/convert/registry";
import { UniversalConverter } from "@/components/convert/UniversalConverter";

export const metadata: Metadata = {
  title: "Universal Converter — drop any file and pick a format",
  description:
    "Not sure which tool you need? Drop a file and NEXORA Convert will show every supported conversion for its format.",
  alternates: { canonical: "/convert" },
};

const STEPS = [
  {
    icon: MousePointerClick,
    title: "1. Drop your file",
    text: "We detect the format locally in your browser before anything is uploaded.",
  },
  {
    icon: SearchCheck,
    title: "2. Pick a target format",
    text: "Only conversions that are actually implemented for that format are listed.",
  },
  {
    icon: PackageCheck,
    title: "3. Convert & download",
    text: "The file is processed on our server and deleted immediately afterwards.",
  },
];

export default async function UniversalConverterPage() {
  const tools = await getAvailableTools();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/tools"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All tools
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Universal Converter
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
        Drop any file and choose from the conversions that genuinely work for its format. No guesswork, no
        dead ends.
      </p>

      <div className="mt-7">
        <UniversalConverter tools={tools} />
      </div>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.title} className="rounded-card border border-border bg-card p-5">
            <step.icon className="h-5 w-5 text-accent-soft" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
