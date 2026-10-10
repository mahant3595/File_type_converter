"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import type { ToolDef } from "@/lib/catalog";
import { NexoraMark } from "./icons";
import { SearchBox } from "./SearchBox";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "All Tools" },
  { href: "/category/images", label: "Images" },
  { href: "/category/pdf", label: "PDF" },
  { href: "/category/documents", label: "Documents" },
  { href: "/category/audio-video", label: "Audio & Video" },
];

export function Header({ tools }: { tools: ToolDef[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const firstLinkRef = React.useRef<HTMLAnchorElement>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  // Close the drawer on Escape and return focus to its trigger.
  React.useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    firstLinkRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Adjust state during render when the route changes (React's documented
  // pattern — avoids a setState-in-effect cascade).
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-accent"
          aria-label="NEXORA Convert — home"
        >
          <NexoraMark className="h-8 w-8 text-foreground" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            NEXORA <span className="font-normal text-muted">Convert</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`rounded-control px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? "font-medium text-foreground"
                  : "text-muted hover:bg-elevated/60 hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden min-w-0 flex-1 justify-end md:flex">
          <div className="w-full max-w-sm xl:max-w-md">
            <SearchBox tools={tools} size="compact" id="header-search" placeholder="Search tools…" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:hidden">
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-card text-muted transition-colors hover:text-foreground"
          >
            {searchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-card text-muted transition-colors hover:text-foreground"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-border bg-surface px-4 py-3 md:hidden">
          <SearchBox tools={tools} size="compact" id="mobile-search" placeholder="Search tools…" />
        </div>
      ) : null}

      {/* Mobile navigation drawer */}
      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div
          className="absolute inset-0 bg-background/70"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
        <div className="absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col border-l border-border bg-surface shadow-pop">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <span className="text-sm font-semibold text-foreground">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => {
                setMenuOpen(false);
                menuButtonRef.current?.focus();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border text-muted transition-colors hover:text-foreground"
            >
              <X className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-control px-3.5 py-3 text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-accent/12 font-medium text-foreground"
                    : "text-muted hover:bg-elevated hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-border p-4 text-xs text-faint">
            Favorites and recent tools are stored only in this browser.
          </div>
        </div>
      </div>
    </header>
  );
}
