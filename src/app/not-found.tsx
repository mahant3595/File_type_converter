import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { getAvailableTools } from "@/server/convert/registry";
import { popularTools } from "@/lib/search";
import { SearchBox } from "@/components/SearchBox";
import { FormatBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

export default async function NotFound() {
  const tools = await getAvailableTools();
  const popular = popularTools(tools, 6);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-panel border border-border bg-card text-accent-soft">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-2 text-base text-muted">
        That link does not exist — maybe the tool moved, or the address has a typo. Search for your conversion
        instead:
      </p>

      <div className="mt-6 w-full">
        <SearchBox tools={tools} size="hero" id="notfound-search" placeholder="Try “PDF to JPG”…" />
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </ButtonLink>
        <ButtonLink href="/tools" variant="secondary">
          Browse all tools
        </ButtonLink>
      </div>

      <ul className="mt-10 flex flex-wrap items-center justify-center gap-2.5" aria-label="Popular conversions">
        {popular.map((tool) => (
          <li key={tool.id}>
            <Link
              href={`/convert/${tool.id}`}
              className="inline-flex items-center gap-2 rounded-control border border-border bg-card px-3.5 py-2.5 text-sm text-foreground transition-colors hover:border-accent/50 hover:bg-elevated"
            >
              {tool.name}
              <FormatBadge from={tool.inputs[0] ?? "?"} to={tool.output} className="border-0 bg-transparent px-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
