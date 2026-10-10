import { Check, ShieldCheck, Upload } from "lucide-react";
import { PRODUCT, type ToolDef } from "@/lib/catalog";
import { SearchBox } from "./SearchBox";
import { ButtonLink } from "./ui/Button";

export function Hero({ tools }: { tools: ToolDef[] }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="hero-field pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 lg:pt-14">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden="true" />
            {tools.length} conversion tools · no sign-up required
          </p>

          <h1 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Every File. Any Format.{" "}
            <span className="text-accent-soft">One Simple Tool.</span>
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {PRODUCT.heroCopy}
          </p>

          <div className="mt-7 max-w-2xl">
            <SearchBox
              tools={tools}
              size="hero"
              id="hero-search"
              placeholder="Search a conversion, e.g. JPG to PNG"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/tools" size="lg">
              Browse All Tools
            </ButtonLink>
            <ButtonLink href="/convert" variant="secondary" size="lg">
              <Upload className="h-4.5 w-4.5" aria-hidden="true" />
              Upload a file
            </ButtonLink>
          </div>

          <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
              Files deleted immediately after conversion
            </li>
            <li className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
              High-quality output with batch support
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
