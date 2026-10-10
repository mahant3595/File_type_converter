"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { ToolDef } from "@/lib/catalog";
import { familyOf } from "@/lib/catalog";
import { limitsFor, TOTAL_UPLOAD_LIMIT } from "@/lib/limits";
import { formatBytes } from "@/lib/validate";
import {
  AbortedError,
  base64ToBlob,
  ConvertClientError,
  uploadConversion,
  type ApiOutput,
} from "@/lib/client-upload";
import { takePendingFiles } from "@/lib/pending-files";
import { Dropzone, FileList, useFileSelection, describeAccept } from "./Dropzone";
import { SettingsForm, defaultOptionValues } from "./SettingsForm";
import { ResultsList, type ResultItem } from "./ResultsList";
import { FormatFamilyIcon } from "../icons";
import { Button } from "../ui/Button";

type Phase = "ready" | "sending" | "processing" | "done" | "error" | "canceled";
type FileStatus = "ready" | "sending" | "converting" | "done" | "failed";

const STEPS = ["Upload", "Configure", "Convert", "Download"] as const;

function stepFor(phase: Phase, hasFiles: boolean): number {
  if (phase === "done") return 4;
  if (phase === "sending" || phase === "processing") return 3;
  return hasFiles ? 2 : 1;
}

export function ConvertWorkspace({ tool }: { tool: ToolDef }) {
  const limits = React.useMemo(() => limitsFor(tool), [tool]);
  const selection = useFileSelection(tool, limits);
  const { files, errors, addFiles, removeFile, clearFiles } = selection;
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [progress, setProgress] = React.useState<number | null>(null);
  const [outputs, setOutputs] = React.useState<ResultItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<Record<string, string | number>>(() =>
    defaultOptionValues(tool),
  );
  const abortRef = React.useRef<AbortController | null>(null);
  const handoffConsumed = React.useRef(false);

  // Pick up a file handed over by the universal converter (same-tab memory only).
  // The files come from an external module store, so they are consumed once and
  // applied in a scheduled callback rather than synchronously in the effect.
  React.useEffect(() => {
    if (handoffConsumed.current) return;
    handoffConsumed.current = true;
    const pending = takePendingFiles();
    if (pending.length > 0) {
      const timer = setTimeout(() => addFiles(pending), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [addFiles]);

  const busy = phase === "sending" || phase === "processing";
  const hasFiles = files.length > 0;

  const statuses = React.useMemo(() => {
    const map: Record<string, FileStatus> = {};
    for (const f of files) {
      map[f.key] =
        phase === "done"
          ? "done"
          : phase === "error" || phase === "canceled"
            ? "failed"
            : phase === "processing"
              ? "converting"
              : phase === "sending"
                ? "sending"
                : "ready";
    }
    return map;
  }, [files, phase]);

  async function convert() {
    if (files.length === 0 || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setOutputs([]);
    setProgress(0);
    setPhase("sending");

    try {
      const raw: ApiOutput[] = await uploadConversion({
        toolId: tool.id,
        files: files.map((f) => f.file),
        options: values,
        signal: controller.signal,
        onSendProgress: (p) => {
          setProgress(p);
          setPhase(p === null ? "processing" : "sending");
        },
      });

      const items: ResultItem[] = [];
      for (const out of raw) {
        items.push({
          name: out.name,
          mime: out.mime,
          size: out.size,
          blob: base64ToBlob(out.data, out.mime),
        });
        // Yield to the event loop so large batches don't freeze the UI.
        if (items.length % 5 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      setOutputs(items);
      setPhase("done");
      // Move focus to the results heading for keyboard/screen-reader users.
      requestAnimationFrame(() => document.getElementById("results-heading")?.focus());
    } catch (e) {
      if (e instanceof AbortedError) {
        setPhase("canceled");
        setError("Conversion canceled. Your files are still selected — convert again whenever you like.");
      } else if (e instanceof ConvertClientError) {
        setPhase("error");
        setError(e.message);
      } else {
        setPhase("error");
        setError("Something went wrong while converting. Please try again.");
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  }

  function reset() {
    clearFiles();
    setOutputs([]);
    setError(null);
    setPhase("ready");
    setProgress(null);
    setValues(defaultOptionValues(tool));
  }

  const inputLabel = tool.inputs.includes("*") ? "Any file" : tool.inputs.map((e) => e.toUpperCase()).join(", ");
  const outputLabel = tool.output === "*" ? "Original files" : tool.output.toUpperCase();
  const currentStep = stepFor(phase, hasFiles);
  const family = familyOf(tool.inputs.includes("*") ? "zip" : tool.inputs[0] ?? "");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_336px]">
      {/* ------------------------------- main ------------------------------- */}
      <div className="min-w-0">
        {/* Step indicator */}
        <ol className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Conversion progress">
          {STEPS.map((label, i) => {
            const step = i + 1;
            const state = step === currentStep ? "current" : step < currentStep ? "done" : "todo";
            return (
              <li
                key={label}
                aria-current={state === "current" ? "step" : undefined}
                className={`flex items-center gap-2 text-sm ${
                  state === "current"
                    ? "font-semibold text-foreground"
                    : state === "done"
                      ? "text-success"
                      : "text-faint"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs tabular-nums ${
                    state === "current"
                      ? "border-accent bg-accent/15 text-accent-soft"
                      : state === "done"
                        ? "border-success/50 bg-success/10"
                        : "border-border"
                  }`}
                >
                  {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : step}
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        {/* Results (success) */}
        {phase === "done" ? (
          <section className="rounded-card border border-success/40 bg-card p-5 sm:p-6" aria-labelledby="results-heading">
            <div className="mb-4 flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-success/40 bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="results-heading" tabIndex={-1} className="text-lg font-semibold text-foreground">
                  Conversion complete
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {tool.name} finished — your file{outputs.length === 1 ? "" : "s"} {outputs.length === 1 ? "is" : "are"} ready to download.
                </p>
              </div>
            </div>
            <ResultsList items={outputs} />
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={reset}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Convert another file
              </Button>
              <Link
                href="/tools"
                className="inline-flex h-11 items-center gap-2 rounded-control border border-border bg-elevated px-5 text-sm text-foreground transition-colors hover:border-border-strong"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to tools
              </Link>
            </div>
          </section>
        ) : (
          <section aria-label="Upload and convert" className="rounded-card border border-border bg-surface p-5 sm:p-6">
            <Dropzone
              tool={tool}
              limits={limits}
              disabled={busy}
              onFiles={(incoming) => {
                if (phase === "error" || phase === "canceled") {
                  setError(null);
                  setPhase("ready");
                }
                addFiles(incoming);
              }}
            />

            <FileList
              files={files}
              onRemove={(key) => {
                if (busy) return;
                removeFile(key);
                if (files.length <= 1) setError(null);
              }}
              disabled={busy}
              statuses={statuses}
            />

            {errors.length > 0 ? (
              <div className="mt-4 rounded-control border border-warning/40 bg-warning/10 p-3" role="alert">
                <p className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Some files were skipped
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-muted">
                  {errors.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-control border border-error/40 bg-error/10 p-3" role="alert">
                <p className="flex items-start gap-2 text-sm font-medium text-error">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </p>
                {(phase === "error" || phase === "canceled") && hasFiles ? (
                  <button
                    type="button"
                    onClick={convert}
                    className="mt-2 inline-flex h-9 items-center gap-2 rounded-control border border-error/50 bg-background px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-error/10"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Try again
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Real progress while bytes are uploading; honest indeterminate state after. */}
            {busy ? (
              <div className="mt-5" aria-live="polite">
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-soft" aria-hidden="true" />
                    {phase === "sending"
                      ? `Uploading… ${progress ?? 0}%`
                      : `Processing on the server…`}
                  </span>
                  <span>{files.length} file{files.length === 1 ? "" : "s"}</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={phase === "sending" ? (progress ?? 0) : undefined}
                  aria-label={phase === "sending" ? "Upload progress" : "Conversion progress"}
                >
                  <div
                    className={`h-full rounded-full bg-accent transition-[width] duration-200 ${
                      phase === "processing" ? "w-1/3 animate-pulse" : ""
                    }`}
                    style={phase === "sending" ? { width: `${progress ?? 0}%` } : undefined}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                onClick={convert}
                disabled={!hasFiles || busy}
                size="lg"
                aria-busy={busy || undefined}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
                    {phase === "sending" ? "Uploading…" : "Converting…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
                    {files.length > 1 ? `Convert ${files.length} files` : "Convert"}
                  </>
                )}
              </Button>

              {busy ? (
                <Button variant="secondary" size="lg" onClick={() => abortRef.current?.abort()}>
                  Cancel
                </Button>
              ) : hasFiles ? (
                <Button variant="ghost" size="lg" onClick={reset}>
                  Clear files
                </Button>
              ) : null}
            </div>
          </section>
        )}

        {/* Honest privacy disclosure */}
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
          <span>
            Files are uploaded over HTTPS and processed by our conversion engine on our server, then deleted
            immediately — we never store them or share them. Audio and video conversions use a temporary server
            folder that is wiped as soon as the conversion ends. Favorites and recent tools stay in this browser only.
          </span>
        </p>
      </div>

      {/* ------------------------------- aside ------------------------------ */}
      <aside className="space-y-4" aria-label="Conversion settings">
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">Conversion</h2>
          <div className="mt-3 flex items-center gap-3 rounded-control border border-border bg-card px-3 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-elevated text-muted">
              <FormatFamilyIcon family={family} className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-xs text-foreground">{inputLabel}</span>
              <span className="block text-[11px] text-faint">source format</span>
            </span>
            <span aria-hidden="true" className="text-accent-soft">
              →
            </span>
            <span className="text-right">
              <span className="block font-mono text-xs text-foreground">{outputLabel}</span>
              <span className="block text-[11px] text-faint">output</span>
            </span>
          </div>

          <div className="mt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Options</h3>
            <SettingsForm
              tool={tool}
              values={values}
              disabled={busy}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface p-5 text-sm">
          <h2 className="text-sm font-semibold text-foreground">Limits</h2>
          <dl className="mt-3 space-y-2 text-muted">
            <div className="flex items-center justify-between gap-3">
              <dt>Accepted</dt>
              <dd className="text-right font-mono text-xs text-foreground">{inputLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Per file</dt>
              <dd className="font-mono text-xs text-foreground">{formatBytes(limits.maxBytesPerFile)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Files at once</dt>
              <dd className="font-mono text-xs text-foreground">
                {tool.batch || tool.multiInput ? limits.maxFiles : 1}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Total per run</dt>
              <dd className="font-mono text-xs text-foreground">{formatBytes(TOTAL_UPLOAD_LIMIT)}</dd>
            </div>
          </dl>
          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-faint">
            {describeAccept(tool, limits)}
          </p>
        </div>
      </aside>
    </div>
  );
}
