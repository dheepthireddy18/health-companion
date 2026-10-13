"use client";
import { useState } from "react";
import { Card, ErrorNote, PageTitle } from "@/components/ui";
import { localDate, put, useFetch } from "@/lib/api";
import type { HabitRow } from "@/lib/types";

export default function HabitsPage() {
  const day = localDate();
  const { data, error, reload } = useFetch<HabitRow[]>(`/habits?day=${day}`);
  const [err, setErr] = useState<string | null>(null);

  const set = async (h: HabitRow, count: number) => {
    try { await put(`/habits/${h.habit_id}/log`, { day, count }); setErr(null); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
  };

  return (
    <>
      <PageTitle sub="Small daily choices. Changes save automatically.">Daily habits</PageTitle>
      <ErrorNote error={error || err} />
      <Card>
        <ul className="divide-y">{(data ?? []).map((h) => (
          <li key={h.habit_id} className="flex items-center justify-between gap-4 py-3">
            <span className="text-lg font-semibold">{h.done ? "✔ " : ""}{h.name}<span className="block text-sm font-normal text-slate-600">Goal: {h.target} {h.unit}</span></span>
            {h.target === 1 ? (
              <input type="checkbox" aria-label={h.name} checked={h.count >= 1} onChange={(e) => set(h, e.target.checked ? 1 : 0)} />
            ) : (
              <input type="number" inputMode="numeric" aria-label={`${h.name} count`} className="!w-24" min={0} max={100}
                value={h.count} onChange={(e) => set(h, Math.max(0, Number(e.target.value) || 0))} />
            )}
          </li>))}</ul>
      </Card>
    </>
  );
}
