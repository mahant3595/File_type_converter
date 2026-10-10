import Link from "next/link";
import { NexoraMark } from "./icons";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/tools", label: "All Tools" },
      { href: "/category/images", label: "Image Tools" },
      { href: "/category/pdf", label: "PDF Tools" },
      { href: "/category/documents", label: "Document Tools" },
      { href: "/category/audio-video", label: "Audio & Video" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/help", label: "Help & FAQ" },
      { href: "/favorites", label: "Favorites" },
      { href: "/convert", label: "Universal Converter" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5">
              <NexoraMark className="h-8 w-8 text-foreground" />
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                NEXORA <span className="font-normal text-muted">Convert</span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Every file. Any format. One simple tool. Real conversions for images, PDFs,
              documents, spreadsheets, audio and video — no account required.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">{col.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} NEXORA Convert. All rights reserved.</p>
          <p>Conversions run on our servers and files are deleted right after processing.</p>
        </div>
      </div>
    </footer>
  );
}
