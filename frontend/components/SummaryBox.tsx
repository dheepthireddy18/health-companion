"use client";
import { useState, type ReactNode } from "react";
import { Sparkles } from "@/components/icons";
import { Btn, ErrorNote } from "@/components/ui";
import { post } from "@/lib/api";
import type { SummaryResult } from "@/lib/types";

/** Name (children) on the left; period picker and the single Summary button beside it; result underneath. */
export default function SummaryBox({ patientId, children, actions }: { patientId: number; children: ReactNode; actions?: ReactNode }) {
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    try { setResult(await post<SummaryResult>(`/clinician/patients/${patientId}/summary?days=${days}`)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create the summary"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">{children}</div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <div className="flex" role="radiogroup" aria-label="Summary period">
              {[7, 30, 90].map((d) => (
                <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${days === d ? "bg-slate-100 text-ink" : "text-ink-muted hover:text-ink"}`}>{d}d</button>
              ))}
            </div>
            <Btn size="sm" onClick={run} disabled={busy} className="ml-1 !bg-none !bg-violet-600 !shadow-none hover:!bg-violet-700">
              <Sparkles size={15} className={busy ? "animate-spin" : ""} />{busy ? "Working…" : "Summary"}
            </Btn>
          </div>
        </div>
      </div>
      <ErrorNote error={error} />
      {result && (
        <div className="animate-slide-in space-y-2 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4" aria-live="polite">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">Summary of the last {result.days} days
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
              {result.source === "llm" ? "✨ Written by AI" : "Automatic (AI not used)"}</span></p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{result.text}</p>
          <p className="text-xs text-ink-muted">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
