# NEXORA Convert

A production-ready, all-in-one **file conversion platform** with a premium dark UI and **real**
conversion engines — not a mockup. Every tool listed in the interface is implemented, tested and
verified end-to-end.

> **Every File. Any Format. One Simple Tool.**
>
> Discover powerful file conversion tools for images, documents, PDFs, audio and video. Get the
> format you need with a simple, secure and intuitive workflow — 54 tools across 8 categories,
> every one backed by a real engine and verified end-to-end.

**Stats:** 54 conversion tools · 8 format categories · 139 automated tests · WCAG 2.2 AA contrast verified

| | | | |
|---|---|---|---|
| **Images** — JPG, PNG, WEBP, GIF, TIFF, AVIF, SVG: convert, resize, rotate, quality | **PDF** — create from images, render pages, extract text, merge & split | **Documents** — Word ↔ Markdown, HTML, plain text | **Spreadsheets** — CSV, XLSX, XLS, ODS + JSON export |
| **Audio** — MP3, WAV, FLAC, OGG, M4A with bitrate control | **Video** — MP4, WEBM, MOV, MKV, AVI, incl. video → audio | **Archives** — create/convert/extract ZIP & TAR (traversal-safe) | **Presentations** — extract text from PPTX |

- 🔍 **Tool discovery first** — searchable, filterable dashboard of 54 working conversion tools
- 🎨 **Premium restrained dark design** — charcoal surfaces, violet accents, Geist type, 8px system
- ⚙️ **Real engines** — sharp (images), pdf-lib + pdfjs (PDF), mammoth/docx (documents), SheetJS
  (spreadsheets), ffmpeg (audio/video), in-memory ZIP/TAR (archives)
- 🔒 **Honest privacy** — files are processed on the server and deleted immediately; nothing is stored
- ♿ **WCAG 2.2 AA** — audited contrast, keyboard navigation, ARIA combobox search, reduced motion
- 🧪 **139 automated tests** + a 18-step HTTP end-to-end verification script

---

## Quick start

```bash
npm ci              # install (also sets up sharp/canvas prebuilds + ffmpeg binary)
npm run dev         # http://localhost:3000
```

Production:

```bash
npm run build
npm start           # serves the production build on :3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Full Vitest suite (unit + conversion + API) |
| `npm run lint` | ESLint (Next.js rules, react-hooks) |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/verify-deps.mjs` | Verify all 11 native engines work |
| `node scripts/verify-deployed.mjs` | HTTP end-to-end checks against a running server |
| `node scripts/verify-all-tools.mjs` | Exhaustive sweep: converts with every advertised tool and validates each output |

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URL / sitemap / robots origin |
| `FFMPEG_PATH` | bundled `ffmpeg-static` | Override the media engine binary |

If ffmpeg is unavailable, audio/video tools are automatically **hidden** (availability gating) —
the UI never advertises a conversion it cannot run.

---

## Architecture

```
src/
├── app/                      # Next.js App Router pages (SSR/SSG + metadata)
│   ├── page.tsx              # Tool discovery dashboard (home)
│   ├── tools/                # All Tools + ?q=/?cat= search deep links
│   ├── category/[slug]/      # Category landings (+ merged audio-video)
│   ├── convert/[tool]/       #54 SSG conversion workspaces (SEO landing pages)
│   ├── convert/              # Universal converter (drop file → pick target)
│   ├── favorites|help|privacy|terms | not-found.tsx
│   ├── api/convert/          # POST multipart → JSON (base64 outputs)
│   └── sitemap.ts|robots.ts
├── components/               # UI: Header, SearchBox, ToolCard, ToolExplorer,
│                             # Dropzone, ConvertWorkspace, ResultsList, …
├── lib/                      # Pure isomorphic logic
│   ├── catalog.ts            # ★ single source of truth: tools, categories, settings
│   ├── search.ts             # ranked search / filtering / counts
│   ├── validate.ts           # filename & path sanitization, ranges, formats
│   ├── limits.ts             # shared client/server limits (test-enforced parity)
│   ├── storage.ts, store.ts  # localStorage + useSyncExternalStore preferences
│   └── client-upload.ts      # XHR transport with real progress + abort
└── server/convert/           # Conversion engine
    ├── registry.ts           # ★ binds catalog ↔ handlers, gates availability
    ├── capabilities.ts       # ffmpeg detection
    ├── tarbuf.ts             # in-memory USTAR/PAX reader-writer
    └── handlers/             # image, pdf, document, sheet, presentation, av, archive
```

**Request flow:** browser validates → `POST /api/convert` (multipart) → server re-validates
(extension, size, count, magic bytes) → handler converts **in memory** (audio/video use a temp dir
deleted in `finally`) → JSON with base64 outputs → browser turns them into Blobs → download.
No file is ever persisted.

### Conversion matrix (verified)

| Category | Tools |
|---|---|
| Images | JPG↔PNG/WEBP, WEBP→PNG/JPG, SVG→PNG/JPG, GIF→PNG/WEBP(animated), TIFF→JPG/PNG, AVIF→JPG/PNG (+quality/resize/scale) |
| PDF | JPG/PNG→PDF (fit/A4), PDF→JPG/PNG (DPI + page filter), PDF→TXT, PDF→DOCX, Merge, Split |
| Documents | DOCX→TXT/MD/HTML, TXT/MD→DOCX |
| Spreadsheets | CSV→XLSX/JSON, XLSX→CSV/ODS, XLS→XLSX/CSV, ODS→XLSX |
| Presentations | PPTX→TXT |
| Audio | WAV→MP3/FLAC, MP3→WAV, FLAC/OGG/M4A→MP3 |
| Video | MP4→MP3/WEBM/GIF, WEBM/MOV/MKV/AVI→MP4 |
| Archives | Files→ZIP/TAR, ZIP↔TAR, Extract ZIP/TAR (traversal-safe) |

**Not offered** (blocked in this environment, intentionally absent from the UI): Word→PDF /
layout-accurate DOCX→PDF (no LibreOffice/Chromium), HEIC input (no HEVC decoder), legacy .doc/.ppt,
BMP/ICO, RAR/7Z/GZ.

## Privacy & security model

- Files: uploaded over HTTPS → converted in memory → returned → deleted. Audio/video use a
  temporary folder removed in `finally`. Nothing stored, nothing shared.
- Validation on client **and** server: extension allow-lists, magic-byte inspection, size/count/total
  limits, filename sanitization, control-char stripping.
- Archives: absolute paths, `..`, drive letters and symlinks are defused on extraction.
- Errors: friendly messages with no server paths, stack traces or file contents in logs.
- Browser-local only: favorites, recent searches/tools (localStorage, labeled as such in the UI).
- No tracking cookies, no third-party analytics, no accounts.

## Testing

```bash
npm test
```

- `registry.test.ts` — catalog ↔ registry integrity, limits parity, availability gating
- `search.test.ts` — ranked queries (`jpg to png`, `pdf to word`, `excel to csv`), unsupported
  formats return **nothing** (`heic to jpg`, `word to pdf`, `rar to zip`)
- `conversions.*.test.ts` — real fixtures generated per run; outputs decoded and asserted
  (dimensions, page counts, cell data, extracted text, magic bytes; TAR cross-read by node-tar)
- `api.convert.test.ts` — success, wrong extension, lying extension, oversize, count limits,
  malformed options, leak-free errors
- `design-tokens.test.ts` — 39 WCAG contrast pairs parsed from `globals.css`

## Live site

**https://mahant3595.github.io/File_type_converter/** — the full app exported statically to
GitHub Pages (`docs/` folder). Browsing, search, favorites and every tool page work; the
conversion *engines* are server-side, so the deployed static site shows an honest
"hosted without the conversion server" message when you start a conversion. Run it locally
(commands above) or deploy to a Node host for real conversions.

## Deployment

### Static export (GitHub Pages / any static host)

```bash
NEXT_OUTPUT=export NEXT_BASE_PATH=/File_type_converter npx next build   # → out/
cp -r out/* docs/                                                       # what Pages serves
```

- `NEXT_OUTPUT=export` switches `next.config.ts` to `output: "export"` with `trailingSlash`
  and the base path baked into every link/asset.
- `NEXT_PUBLIC_BASE_PATH` (inlined at build) points the upload transport at
  `<base>/api/convert`; without a server it fails **honestly** with an explanatory message.
- The API route exports as a static 405 stub — POSTs never reach it on a static host.

### Node host (full functionality)

Requires a **Node.js host** (the conversion engines run server-side):

```bash
npm ci && npm run build && npm start
```

- Put it behind HTTPS (e.g. a reverse proxy / platform load balancer).
- Add rate limiting at the proxy for `/api/convert` in production.
- Static-only runtimes (e.g. Cloudflare Workers) are **not** supported — they cannot execute these
  engines; the UI will build but conversions would need porting.
- Optionally set `NEXT_PUBLIC_SITE_URL` for correct canonical/sitemap URLs.

## Customization

- Brand/copy: `PRODUCT` in `src/lib/catalog.ts`, metadata in `src/app/layout.tsx`, logo mark in
  `src/components/icons.tsx` (`NexoraMark`).
- Palette: `@theme` tokens in `src/app/globals.css` (contrast is test-enforced — update
  `tests/design-tokens.test.ts` expectations if you change core colors).
- Tools: add an entry to `TOOLS` in `src/lib/catalog.ts` + a handler in `src/server/convert/`
  (tests will fail if the binding, limits or search behavior is inconsistent).
