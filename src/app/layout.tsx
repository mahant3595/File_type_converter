import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { getAvailableTools } from "@/server/convert/registry";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FavoritesProvider } from "@/components/FavoritesProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "NEXORA Convert — Every File. Any Format. One Simple Tool.",
    template: "%s | NEXORA Convert",
  },
  description:
    "Discover powerful file conversion tools for images, documents, PDFs, audio, and video. Get the format you need with a simple, secure, and intuitive workflow.",
  keywords: [
    "file converter", "image converter", "pdf converter", "jpg to png", "pdf to word",
    "mp4 to mp3", "csv to xlsx", "online file conversion",
  ],
  openGraph: {
    type: "website",
    siteName: "NEXORA Convert",
    title: "NEXORA Convert — Every File. Any Format. One Simple Tool.",
    description:
      "Discover powerful file conversion tools for images, documents, PDFs, audio, and video.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tools = await getAvailableTools();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:border focus:border-accent focus:bg-elevated focus:px-4 focus:py-2.5 focus:text-sm focus:text-foreground"
        >
          Skip to main content
        </a>
        <FavoritesProvider>
          <Header tools={tools} />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </FavoritesProvider>
      </body>
    </html>
  );
}
