"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { familyOf, type ToolDef } from "@/lib/catalog";
import { FormatBadge } from "./ui/Badge";
import { FormatFamilyIcon } from "./icons";
import { FavoriteButton } from "./FavoriteButton";
import { useFavorites } from "./FavoritesProvider";

export function ToolCard({ tool }: { tool: ToolDef }) {
  const { openTool } = useFavorites();
  const inputExt = tool.inputs.includes("*") ? "any" : tool.inputs[0] ?? "?";

  return (
    <article className="group relative flex h-full flex-col">
      <Link
        href={`/convert/${tool.id}`}
        onClick={() => openTool(tool.id)}
        className="flex h-full flex-col rounded-card border border-border bg-card p-4 transition-colors duration-150 hover:border-accent/50 hover:bg-elevated/50 sm:p-5"
        aria-label={`${tool.name} — ${tool.description}`}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-elevated text-muted transition-colors duration-150 group-hover:border-accent/40 group-hover:text-accent-soft">
            <FormatFamilyIcon
              family={tool.output === "*" ? familyOf(inputExt) : familyOf(tool.output) === "unknown" ? familyOf(inputExt) : familyOf(tool.output)}
              className="h-5 w-5"
            />
          </span>
          <ArrowRight
            className="h-4 w-4 translate-x-0 text-faint opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-accent-soft group-hover:opacity-100"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-[15px] font-semibold leading-tight text-foreground">{tool.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted">{tool.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <FormatBadge from={inputExt} to={tool.output} />
          <span className="text-xs font-medium text-accent-soft">Convert</span>
        </div>
      </Link>
      <FavoriteButton
        toolId={tool.id}
        toolName={tool.name}
        className="absolute right-3 top-3 z-10"
      />
    </article>
  );
}
