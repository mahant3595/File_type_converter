# NEXORA Convert — Implementation Plan

> Living project checklist. Created **before** any application code (mandatory Phase 1 step).
> Updated continuously: a task is marked `[x]` only after it is implemented **and verified**.
> Newly discovered tasks are added here; blocked tasks stay open with a documented reason.

---

## 1. Project overview and goals

**NEXORA Convert** is a production-ready, responsive, all-in-one file-conversion website with a
premium dark aesthetic and **real** file-conversion functionality (no mocked results).

Goals:

1. **Tool discovery first** — users immediately see what the site can do via a searchable,
   filterable grid of conversion tool cards.
2. **Real conversions** — every tool shown in the UI is backed by an actually implemented and
   tested conversion handler. Never advertise an unsupported conversion.
3. **Trustworthy workflow** — upload → configure → convert → download with honest states
   (no fabricated progress or fake success).
4. **Premium restrained dark UI** — charcoal surfaces, violet accents, minimal line icons,
   8px spacing system, WCAG 2.2 AA.
5. **Maintainable production code** — centralized registry, reusable components, tests.

Non-goals (v1): user accounts, cloud storage of files, paid plans, LibreOffice/Office-class
layout-accurate document rendering (environment has no root for system packages).

---

## 2. Technology stack and architecture

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | SSR/SEO, per-tool landing routes, API route handlers |
| Language | TypeScript (strict) | safety, registry typing |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) | design-token system from the mandated palette |
| Icons | lucide-react | minimal line icons |
| Fonts | `geist` (self-hosted) | modern sans, no build-time network fetch |
| Conversion engine | **Server-side** Node route handlers (pure handler functions) | sharp/pdf-lib/pdfjs/mammoth/xlsx/ffmpeg are Node-native; testable in isolation |
| Images | sharp (libvips) | JPG/PNG/WEBP/AVIF/TIFF/GIF/SVG, resize/crop/rotate, quality |
| PDF | pdf-lib (create/manipulate) + pdfjs-dist (render/extract) | JPG/PNG→PDF, PDF→JPG/PNG/TXT/DOCX, merge/split |
| Documents | mammoth (DOCX→HTML/TXT/MD), docx (TXT/MD→DOCX) | real, honest text-level conversions |
| Spreadsheets | SheetJS `xlsx` (CSV↔XLSX, XLS→XLSX/CSV) | real cell-level conversions |
| Audio/Video | `ffmpeg-static` binary invoked from handlers | MP4→MP3, WAV→MP3, MP4→WEBM, … |
| Archives | archiver (ZIP create), node-tar (TAR), unzipper/yauzl (extract) with path-traversal guards | ZIP↔TAR, extract |
| Upload transport | `multipart/form-data` request → JSON response with base64 outputs | **no temp files, no server persistence** → simple, auditable privacy story |
| Browser helpers | `client-zip` (Download All), `file-type` (magic-byte validation) | batch download, signature checks |
| Tests | Vitest (unit + handler tests with real generated fixtures) | verified outputs |
| Lint/type | ESLint (Next config) + `tsc --noEmit` | |

**Architecture:**

- `src/lib/` — pure, isomorphic: tool catalog, search/filter logic, formatting, validation helpers.
- `src/server/convert/` — conversion handlers (`async (inputs: Buffer[], options) => outputs`),
  capability detection (ffmpeg present?), registry binding catalog ↔ handlers.
- `src/app/api/convert/route.ts` — thin HTTP layer: validation → handler → base64 JSON.
- `src/components/` — reusable UI (Button, ToolCard, SearchBox, Dropzone, Workspace, …).
- `src/app/**` — pages (server components render metadata + pass available tools to client UI).

**Data flow:** client reads `File`s → validates (ext/size/count/signature) → base64 in multipart
POST → server validates again (name, size, magic bytes) → handler converts **in memory** →
JSON `{ outputs: [{ name, mime, data }] }` → client creates Blobs → download. Nothing is written
to disk or retained beyond the request.

---

## 3. Design system and UI/UX guidelines

Mandated palette (implemented as CSS custom properties / Tailwind `@theme` tokens):

- bg `#09090B` · bg-2 `#111116` · card `#17171F` · elevated `#20202A`
- accent `#8B5CF6` (primary) · accent-2 `#22D3EE` (sparing)
- text `#FAFAFA` · text-2 `#A1A1AA` · border `#2B2B36`
- success `#34D399` · warning `#FBBF24` · error `#FB7185`

Guidelines:

- Inter/Geist sans, restrained headings, strong hierarchy, readable across devices.
- Radii 12–18px; subtle 1px borders; restrained shadows; 8px spacing scale; short transitions
  (120–180ms); clearly visible `:focus-visible` rings; consistent button sizes.
- No excessive gradients, neon, glassmorphism, oversized illustrations.
- Violet = primary interactive color; cyan only for secondary highlights.
- Contrast: verify text/background pairs ≥ 4.5:1 (3:1 for large/UI) with a script; adjust token
  usage where a pair fails.

## 4. Application page structure

- `/` — Tool Discovery Dashboard: nav, hero (headline/sub/search/actions/privacy note), popular
  conversions, category filter, tool grid, favorites & recent (when present).
- `/tools` — all-tools directory + search results + empty states (`?q=` deep-linkable).
- `/category/[slug]` — category landing (images, pdf, documents, spreadsheets, presentations,
  audio, video, archives).
- `/convert/[tool]` — conversion workspace (4 steps: upload → configure → convert → download);
  per-tool SEO metadata via `generateMetadata` + `generateStaticParams`.
- `/convert` — universal converter: drop a file → pick a supported target from the registry.
- `/favorites` — favorites + recently used (localStorage, clearly labeled "stored in this browser").
- `/help` — FAQ (structured data where valid) · `/privacy` · `/terms` · `404`.

## 5. Reusable component architecture

Header (logo, nav, global search, mobile drawer) · Footer · Hero · SearchBox (ARIA combobox:
suggestions, keyboard nav, Enter/Esc, clear, recent searches, live announcements) ·
CategoryTabs (scrollable, counts, active state) · ToolCard + FavoriteButton · PopularStrip ·
SectionHeading · Button/Badge/Chip/Input/Select · Dropzone + FileList (validation, removal) ·
ConvertProgress (per-file status, cancel, retry) · ResultsList (download / download all) ·
EmptyState · FAQ accordion · SEO JSON-LD helpers.

## 6. Supported formats and conversion matrix

Legend: ✅ implemented+tested · 🟡 planned this pass · ❌ unsupported in this environment
(hidden from UI; documented). **Only ✅/🟡 tools are ever rendered to users** (availability
gated by capability detection).

### Images (sharp)
- [x] ✅ JPG/JPEG → PNG, WEBP, PDF
- [x] ✅ PNG → JPG, WEBP, PDF
- [x] ✅ WEBP → JPG, PNG
- [x] ✅ GIF → PNG (first frame) · GIF → WEBP (animation preserved)
- [x] ✅ TIFF → JPG/PNG · SVG → PNG/JPG · AVIF → JPG/PNG
- [ ] ❌ PNG → ICO, BMP inputs — dropped: not supported by the sharp build (never advertised)
- [ ] ❌ HEIC/HEIF → JPG/PNG — **blocked:** sharp's libheif has only an AV1 decoder (no libde265)
      and ffmpeg has no HEIF demuxer here; no verified decode path → not advertised
- [x] settings: quality, resize (max width/height), rotate/auto-orient

### PDF (pdf-lib + pdfjs-dist)
- [x] ✅ JPG/PNG → PDF (fit/A4) · PDF → JPG · PDF → PNG (DPI + page filter) · PDF → TXT ·
      PDF → DOCX (text-level extraction — described honestly on the tool page)
- [x] ✅ Merge PDF (multi-input, ordered) · Split PDF (one output per page range)
- [ ] ❌ layout-accurate PDF→Office — blocked (no LibreOffice; text-level PDF→DOCX is offered instead)

### Documents
- [x] ✅ DOCX → TXT / Markdown / HTML (mammoth + turndown) · TXT/MD → DOCX (docx, real headings/bullets)
- [x] ✅ PDF → DOCX via text extraction (included above)
- [ ] ❌ DOC/PPT legacy binary — blocked (no parser available without LibreOffice)
- [ ] ❌ Word → PDF / DOCX → PDF (pixel-accurate) — **blocked:** Chromium needs system libs
      (nss3, atk, cups, asound…) unavailable without root; LibreOffice not installable → not advertised

### Spreadsheets (SheetJS)
- [x] ✅ CSV → XLSX · XLSX → CSV · XLS → XLSX · XLS → CSV · ODS → XLSX · XLSX → ODS · CSV → JSON

### Audio/Video (ffmpeg-static; tools gated on binary presence)
- [x] ✅ MP4 → MP3 · MP4 → WEBM · MP4 → GIF · WEBM → MP4 · MOV/MKV/AVI → MP4 ·
      WAV → MP3 · MP3 → WAV · WAV → FLAC · FLAC/OGG/M4A → MP3 (ffmpeg-static)

### Archives
- [x] ✅ Files → ZIP · Files → TAR · ZIP → TAR · TAR → ZIP · Extract ZIP · Extract TAR
      (path-traversal + symlink safe; TAR reader/writer cross-checked against node-tar)

## 7–14. Task checklists

### Phase A — Planning & scaffold
- [x] Task 1: Create root-level `plan.md` before any application code (this file).
- [x] Task 2: Scaffold Next.js 16 + TS + Tailwind v4 + ESLint; install conversion deps; verify
      each native dep actually works in this environment (sharp, pdfjs+canvas, ffmpeg-static,
      xlsx, mammoth) — record any that fail as blocked and adjust the matrix.

### Phase B — Design system & shell
- [x] Task 3: Implement design tokens (palette, spacing, radii, motion) in `globals.css` @theme.
- [x] Task 4: Build reusable primitives: Button, Badge, Input, Select, SectionHeading, EmptyState.
- [x] Task 5: Header (logo, nav, global search, accessible mobile drawer) + Footer + skip link.
- [x] Task 6: Contrast audit script for text/background pairs; fix failures.

### Phase C — Tool discovery dashboard (defining feature)
- [x] Task 7: Tool catalog (`src/lib/catalog.ts`): tool definitions, categories, keywords,
      popularity, settings schema; category list with real counts.
- [x] Task 8: SearchBox — case-insensitive matching on name/ext/category/phrases, ranked
      suggestions, full keyboard nav (↑↓/Enter/Esc), clear control, recent searches (localStorage),
      aria-live result announcements, empty state with suggestions.
- [x] Task 9: CategoryTabs with icons + genuine counts, active state, keyboard access,
      mobile horizontal scroll; preserves query.
- [x] Task 10: ToolCard grid (4–5/3/1–2 cols), hover/focus states, favorite control that does not
      fight card navigation, consistent heights.
- [x] Task 11: Popular Conversions strip (curated, compact).
- [x] Task 12: Favorites + recently used (localStorage, labeled as browser-local, clear action).
- [x] Task 13: Hero: exact headline/subtext, prominent search, Browse All Tools, Upload action
      (universal converter), privacy/quality note, subtle background accent, compact height.

### Phase D — Conversion engine
- [x] Task 14: Conversion registry: catalog ↔ handler binding, limits, MIME types, batch flag,
      settings schema; capability detection (ffmpeg) gating availability.
- [x] Task 15: Image handlers (sharp) + settings (quality/resize/orient).
- [x] Task 16: PDF handlers (create from images, render to images, extract text, merge/split).
- [x] Task 17: Document handlers (DOCX↔text) and spreadsheet handlers (CSV/XLSX/XLS).
- [x] Task 18: Audio/video handlers (ffmpeg) with format-appropriate flags.
- [x] Task 19: Archive handlers (ZIP/TAR create, convert, extract) with path-traversal-safe names.
- [x] Task 20: `POST /api/convert`: multipart parsing, validation, error taxonomy (safe messages,
      no paths/traces), size limits, base64 JSON responses.

### Phase E — Conversion workspace
- [x] Task 21: `/convert/[tool]` shell with per-tool metadata (title/description/FAQ JSON-LD).
- [x] Task 22: Dropzone: browse + drag-drop, multi-file when batch, filename/size/type display,
      client validation (ext/size/count/signature), removal, clear limits, helpful errors.
- [x] Task 23: Configure step: source→target indicator, settings controls, file count/size.
- [x] Task 24: Convert step: real states only (upload % via XHR is real; processing is
      indeterminate), per-file status for batches, cancel (abort), retry.
- [x] Task 25: Download step: success status, output names/sizes, per-file download, Download All
      (client-zip), Convert Another, Return to Tools; filenames/extensions preserved.
- [x] Task 26: Universal `/convert` flow (drop file → choose target from registry).

### Phase F — Additional pages
- [x] Task 27: `/tools` directory + search results + empty states.
- [x] Task 28: `/category/[slug]` landing pages.
- [x] Task 29: `/favorites` page.
- [x] Task 30: `/help` FAQ, `/privacy`, `/terms`, custom 404 — no dead links or inert controls.

### Phase G — Security, privacy, reliability
- [x] Task 31: Double validation (client + server), magic-byte signature checks, filename
      sanitization (ext traversal/control chars), request size limits, handler timeouts.
- [x] Task 32: Safe archive extraction (no absolute paths / `..` / symlink escapes).
- [x] Task 33: Accurate privacy disclosure: files processed in memory on the server, not stored,
      not retained; browser-local storage explained where used.
- [x] Task 34: Error handling: corrupted files, unsupported codecs, oversized inputs → actionable
      messages; no server paths/stack traces leaked.

### Phase H — Accessibility, responsive, SEO, performance
- [x] Task 35: WCAG 2.2 AA pass: semantics, landmarks, focus indicators, labels, contrast,
      reduced-motion, touch targets, status not color-only.
- [ ] Task 36: Responsive verification at 360/390/768/1024/1440/1920 widths (grid + nav + workspace).
  - **status:** responsive behavior implemented by construction (1/2/3/4-col grids, drawer nav,
    scroll rails, stacked workspace) and SSR-verified — but automated pixel verification is
    impossible in this environment (no browser engine), so this stays open until a manual
    preview review at those widths.
- [x] Task 37: Metadata for every route; per-tool landing titles/descriptions; related conversions;
      valid FAQ structured data; sitemap + robots.
- [x] Task 38: Performance: lazy-load heavy deps, dynamic import client helpers, keep initial JS lean.

### Phase I — Testing & verification
- [x] Task 39: Unit tests: catalog/registry integrity (every visible tool ↔ registered handler),
      search/filter logic, filename sanitization, size/extension validation.
- [x] Task 40: Conversion tests with **real fixture files**: generate inputs, convert, decode
      outputs and assert properties (dimensions, MIME, page count, row data, playable stream).
- [x] Task 41: API route tests (success, bad file, unsupported combo, oversize).
- [x] Task 42: UI smoke: production build + SSR HTML assertions for key routes (headings, tool
      cards, no unavailable tools listed); dev-server preview verification.
- [x] Task 43: Run full suite, fix failures, re-run after fixes.

- [x] Task 46: Exhaustive per-tool verification (`scripts/verify-all-tools.mjs`): every tool the
      homepage advertises converts through the live `POST /api/convert` with non-default settings,
      outputs validated by extension + magic bytes/text, landing pages render, catalog ↔ UI parity.
      Found and fixed 3 magic-sniff false rejections: legacy `.xls` (sniffs `cfb`), Opus-in-`.ogg`
      (sniffs `opus`), ipod-brand `.m4a` (sniffs `m4v`) — each now has a regression test.

### Phase J — Documentation & deployment
- [x] Task 44: README: setup, dev, test, build, deploy (Node host), env vars (FFMPEG_PATH),
      architecture, privacy model.
- [x] Task 45: Final review: walk every workflow, update all checkboxes honestly, document
      limitations and blocked tasks.
- [x] Task 47: Deploy the actual website to GitHub Pages (published from the `gh-pages` branch,
      live at
      https://mahant3595.github.io/File_type_converter/). Env-gated static export
      (`NEXT_OUTPUT=export` + `NEXT_PUBLIC_BASE_PATH`) with `trailingSlash` for static-host
      URL resolution; `tools/?q=` deep links converted to client-side URL sync so the `/tools`
      page stays static; `/api/convert` exports as a static 405 stub and the upload transport
      fails **honestly** ("hosted without the conversion server — run locally or deploy to a
      Node host") instead of showing a raw status. Root `index.html` landing page folded into
      README and removed. `.nojekyll` ensures `_next/` is served. Verified: local Pages-sim
      smoke test (all routes + assets 200 under the sub-path), Node build keeps `/api/convert`
      dynamic, tsc/lint/139 tests green.

## 15. Acceptance criteria (summary)

1. `plan.md` exists first and reflects reality.
2. `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test` pass.
3. Homepage shows hero + searchable/filterable grid of **only implemented** tools; search
   handles `JPG to PNG`, `PDF to Word`, `MP4 to MP3`, `Compress PDF`-style queries with keyboard
   navigation and accessible announcements.
4. Each advertised tool has a working `/convert/[tool]` page whose end-to-end conversion produces
   a downloadable file verified by tests.
5. Batch conversion, cancel/retry, download-all work; failures show honest errors.
6. No dead links/controls; 404 and legal/help pages exist.
7. AA contrast, visible focus, reduced motion, responsive 360–1920px.
8. Privacy wording matches the actual technical behavior.

## Known risks / environment constraints (updated during work)

- No root → no LibreOffice/system ffmpeg; audio+video depend on `ffmpeg-static` npm binary.
- Node-only deployment for server-side conversions (Cloudflare Workers static hosting cannot run
  these handlers) — documented in README.
- Native deps (`canvas` for pdfjs rendering, `sharp`) must be verified on install; failures
  remove the dependent tools from the UI rather than shipping broken conversions.


---

## Final status (post-implementation)

### Verification summary

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` (ESLint, Next rules incl. react-hooks) | clean, 0 problems |
| `npm test` (Vitest) | **139 passed, 1 conditional skip** across 10 files |
| `npm run build` (Next 16) | clean — 74 static pages (54 tool landing pages + 9 categories + static) |
| `scripts/verify-deployed.mjs` (HTTP E2E vs production server) | **18/18** — routes, SSR content, SEO/a11y markers, live conversions (JPG→PNG, batch, PDF→TXT, CSV→XLSX, WAV→MP3, merge, ZIP) and security rejections |
| `scripts/verify-all-tools.mjs` (exhaustive HTTP sweep vs running server) | **109/109** — all 54 advertised tools converted live with non-default settings, all 54 landing pages render, catalog ↔ UI parity |
| Engine verification (`scripts/verify-deps.mjs`) | 11/11 native deps OK |
| Contrast audit (`tests/design-tokens.test.ts`) | 39/39 WCAG AA pairs pass |

### Blocked / not advertised (honest gaps)

1. **Word → PDF / layout-accurate DOCX → PDF** — needs LibreOffice or a browser engine; neither is
   installable in this environment (no root, Chromium's system libs missing). Tool is not in the catalog.
2. **HEIC/HEIF input** — no HEVC-capable decoder in the shipped sharp libheif, no HEIF demuxer in ffmpeg.
3. **Legacy `.doc` / `.ppt` binaries, BMP/ICO, RAR/7Z/GZ** — no reliable engine chosen; not offered.
4. **Interactive browser checks** (drag-and-drop gesture, full keyboard pass, mobile emulation at
   360–1920px) cannot be automated here — no browser engine. Responsive behavior is implemented by
   construction and SSR-verified; visual review in the preview is the remaining manual step.
5. Deployment target: server-side engines require a **Node host** (`next start`); static-only hosts
   (e.g. Cloudflare Workers) cannot run the conversion API.

### How to run

```bash
npm ci            # install (runs sharp/canvas/ffmpeg binary setup)
npm run dev       # development on http://localhost:3000
npm test          # full test suite
npm run lint && npx tsc --noEmit
npm run build && npm start   # production
node scripts/verify-deployed.mjs   # HTTP E2E against a running server
node scripts/verify-all-tools.mjs  # exhaustive sweep: every tool, every landing page
```

Env vars: `NEXT_PUBLIC_SITE_URL` (canonical/sitemap origin), `FFMPEG_PATH` (optional override for the
media engine binary).
