"use client";

import type { CategoryId } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog";
import { CategoryIcon } from "./icons";
import { CountBadge } from "./ui/Badge";

export type CategoryFilter = CategoryId | "all";

export function CategoryTabs({
  active,
  counts,
  onChange,
  className = "",
}: {
  active: CategoryFilter;
  counts: Record<CategoryId, number> & { total: number };
  onChange: (next: CategoryFilter) => void;
  className?: string;
}) {
  const items: { id: CategoryFilter; label: string; count: number }[] = [
    { id: "all", label: "All Tools", count: counts.total },
    ...CATEGORIES.map((c) => ({ id: c.id as CategoryFilter, label: c.label, count: counts[c.id] ?? 0 })),
  ];

  return (
    <div
      role="group"
      aria-label="Filter tools by category"
      className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 ${className}`}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-control border px-3.5 py-2 text-sm transition-colors duration-150 ${
              isActive
                ? "border-accent/60 bg-accent/15 font-medium text-foreground"
                : "border-border bg-card text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            <CategoryIcon category={item.id} className={`h-4 w-4 ${isActive ? "text-accent-soft" : ""}`} />
            <span>{item.label}</span>
            <CountBadge count={item.count} />
          </button>
        );
      })}
    </div>
  );
}
