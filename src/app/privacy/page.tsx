import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How NEXORA Convert handles your files: server-side processing, immediate deletion, browser-local preferences and no tracking.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: "The short version",
    body: (
      <>
        Conversion files are processed on our server and deleted immediately afterwards. We do not store them,
        do not review them and do not share them. Your favorites and recent searches stay in your browser.
        We do not use tracking cookies or third-party analytics.
      </>
    ),
  },
  {
    h: "Files you convert",
    body: (
      <>
        When you convert a file, it is uploaded over HTTPS to our server, processed in memory by the relevant
        conversion engine, and the result is returned to you. Audio and video conversions are the exception that
        proves the rule: they are written to a temporary server folder which is deleted as soon as the conversion
        finishes. No converted file, source file or extracted content is retained after the request completes,
        and nothing is written to durable storage.
      </>
    ),
  },
  {
    h: "What we do log",
    body: (
      <>
        We keep ordinary web-server operational logs (such as request time and response status) to monitor
        reliability and abuse. Conversion errors are logged with their error code and message only — file
        contents, file names and server paths are never included.
      </>
    ),
  },
  {
    h: "Browser-local storage",
    body: (
      <>
        Favorites, recently opened tools and recent searches are saved in your browser&apos;s local storage so the
        interface can be personal without an account. This data never leaves your device; clearing your browser
        storage removes it permanently. You can clear recents from the Favorites page at any time.
      </>
    ),
  },
  {
    h: "Cookies and tracking",
    body: (
      <>
        NEXORA Convert does not set advertising or analytics cookies and does not embed third-party trackers,
        embedded players or social widgets. No account or sign-in is required to convert files.
      </>
    ),
  },
  {
    h: "Security controls",
    body: (
      <>
        Uploaded files are validated on both the client and the server: extension checks, magic-byte signature
        inspection, per-file and per-run size limits, filename sanitization and archive path-traversal
        protection. Uploaded content is data only — it is never executed. In production the service runs behind
        HTTPS, and conversion endpoints are rate-limited to prevent abuse.
      </>
    ),
  },
  {
    h: "Retention and deletion",
    body: (
      <>
        Source files and conversion outputs are deleted at the end of the request that created them. If a
        conversion crashes, any temporary files left behind belong to a throwaway temporary folder that is
        cleaned on the next run.
      </>
    ),
  },
  {
    h: "Changes to this policy",
    body: (
      <>
        If the processing model ever changes (for example, if a conversion moves to a browser-local engine or a
        subprocessing provider), this page will say so explicitly before that happens. Last updated: October 2026.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-base text-muted">
        Written to match what the code actually does — no promises we cannot keep.
      </p>
      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.h} aria-labelledby={`p-${s.h.replace(/\s+/g, "-").toLowerCase()}`}>
            <h2
              id={`p-${s.h.replace(/\s+/g, "-").toLowerCase()}`}
              className="text-lg font-semibold text-foreground"
            >
              {s.h}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
