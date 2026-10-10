import type { Metadata } from "next";
import { FavoritesPanel } from "@/components/FavoritesPanel";

export const metadata: Metadata = {
  title: "Favorites & recent tools",
  description:
    "Your favorite conversion tools and recently used converters, stored locally in this browser.",
  alternates: { canonical: "/favorites" },
};

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Favorites &amp; recent tools
      </h1>
      <p className="mt-2 max-w-2xl text-base text-muted">
        Your shortcuts, kept in this browser only — no account, no sync, no tracking.
      </p>
      <div className="mt-8">
        <FavoritesPanel />
      </div>
    </div>
  );
}
