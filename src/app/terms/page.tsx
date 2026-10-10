import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using NEXORA Convert: acceptable use, availability, disclaimers and liability.",
  alternates: { canonical: "/terms" },
};

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: "1. Acceptance",
    body: (
      <>
        By using NEXORA Convert you agree to these terms. If you do not agree, do not use the service. The
        service is provided as-is for file conversion purposes.
      </>
    ),
  },
  {
    h: "2. Acceptable use",
    body: (
      <>
        You may only convert files you have the right to process. Do not upload malware, unlawful content,
        content that infringes the rights of others, or material you are not authorized to process. We may
        throttle or block requests that look like abuse (for example, automated hammering of conversion
        endpoints), and we may refuse files that put the service at risk.
      </>
    ),
  },
  {
    h: "3. Your files",
    body: (
      <>
        You keep all rights to your files. As described in our{" "}
        <a href="/privacy" className="text-accent-soft underline-offset-4 hover:underline">
          Privacy Policy
        </a>
        , files are processed for the conversion you requested and deleted immediately afterwards. You are
        responsible for keeping your own copies — the service is not file storage and offers no recovery.
      </>
    ),
  },
  {
    h: "4. Availability and accuracy",
    body: (
      <>
        We work hard to keep conversions faithful, but formats, codecs and layout fidelity vary. Some
        conversions are text-level by nature (for example PDF to Word extracts text rather than recreating the
        visual layout), and each tool page describes what it does. Features may change, and tools may be added
        or removed as engines evolve. Only conversions that are actually implemented are listed.
      </>
    ),
  },
  {
    h: "5. Disclaimers",
    body: (
      <>
        The service is provided “as is” without warranties of any kind, express or implied, including
        merchantability, fitness for a particular purpose and non-infringement. Always keep originals of
        important files.
      </>
    ),
  },
  {
    h: "6. Limitation of liability",
    body: (
      <>
        To the maximum extent permitted by law, NEXORA Convert is not liable for any indirect, incidental or
        consequential damages arising from use of the service, including data loss resulting from relying on it
        as your only copy of a file.
      </>
    ),
  },
  {
    h: "7. Changes",
    body: (
      <>
        We may update these terms as the product evolves. Continued use after changes means you accept the
        updated terms. Last updated: October 2026.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Terms of Service</h1>
      <p className="mt-2 text-base text-muted">The ground rules for using NEXORA Convert.</p>
      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.h} aria-labelledby={`t-${s.h.replace(/\s+/g, "-").toLowerCase()}`}>
            <h2 id={`t-${s.h.replace(/\s+/g, "-").toLowerCase()}`} className="text-lg font-semibold text-foreground">
              {s.h}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
