import type { Metadata } from "next";
import { getAvailableTools } from "@/server/convert/registry";
import { popularTools } from "@/lib/search";
import { Hero } from "@/components/Hero";
import { PopularStrip } from "@/components/PopularStrip";
import { YourTools } from "@/components/YourTools";
import { ToolExplorer } from "@/components/ToolExplorer";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "NEXORA Convert — Every File. Any Format. One Simple Tool.",
  description:
    "Discover powerful file conversion tools for images, documents, PDFs, audio, and video. Get the format you need with a simple, secure, and intuitive workflow.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const tools = await getAvailableTools();
  const popular = popularTools(tools, 8);

  return (
    <>
      <Hero tools={tools} />

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <PopularStrip tools={popular} />

        <section aria-labelledby="directory-heading" className="mt-10">
          <SectionHeading
            id="directory-heading"
            title="All conversion tools"
            description="Every tool below is implemented and tested — search or filter to find your format."
            action={
              <a
                href="#directory-heading"
                className="sr-only focus:not-sr-only focus:rounded-control focus:border focus:border-accent focus:px-3 focus:py-2 focus:text-sm"
              >
                Jump to tool directory
              </a>
            }
          />
          <ToolExplorer tools={tools} />
        </section>

        <YourTools />
      </div>
    </>
  );
}
