"use client";
import { useState, type ReactNode } from "react";
import { Btn, ErrorNote } from "@/components/ui";
import { post } from "@/lib/api";
import type { SummaryResult } from "@/lib/types";

/** Name (children) on the left; period picker and the single Summary button beside it; result underneath. */
export default function SummaryBox({ patientId, children }: { patientId: number; children: ReactNode }) {
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
        <div>{children}</div>
        <div className="flex items-center gap-2">
          <select aria-label="Summary period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="!w-auto">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
          <Btn onClick={run} disabled={busy}>{busy ? "Working…" : "Summary"}</Btn>
        </div>
      </div>
      <ErrorNote error={error} />
      {result && (
        <div className="space-y-2 rounded-xl border-2 border-teal-700 bg-teal-50 p-4" aria-live="polite">
          <p className="font-bold">Summary of the last {result.days} days
            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-sm font-semibold">
              {result.source === "llm" ? "Written by AI" : "Automatic (AI not used)"}</span></p>
          <p className="whitespace-pre-line">{result.text}</p>
          <p className="text-sm text-slate-700">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
