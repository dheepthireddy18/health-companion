"use client";
import { useState } from "react";
import Burst from "@/components/Burst";
import { useToast } from "@/components/Toast";
import { Check } from "@/components/icons";
import { Card, ErrorNote, PageTitle, Progress, Skeleton } from "@/components/ui";
import { localDate, put, useFetch } from "@/lib/api";
import { sfx } from "@/lib/sound";
import type { HabitRow } from "@/lib/types";

export default function HabitsPage() {
  const toast = useToast();
  const day = localDate();
  const { data, error, reload } = useFetch<HabitRow[]>(`/habits?day=${day}`);
  const [celebrate, setCelebrate] = useState<Record<number, number>>({});

  const set = async (h: HabitRow, count: number) => {
    const n = Math.max(0, Math.min(100, count));
    try {
      await put(`/habits/${h.habit_id}/log`, { day, count: n });
      if (!h.done && n >= h.target) { sfx.chime(); setCelebrate((c) => ({ ...c, [h.habit_id]: (c[h.habit_id] ?? 0) + 1 })); }
      reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); }
  };

  const done = data?.filter((h) => h.done).length ?? 0;
  return (
    <>
      <PageTitle eyebrow="Habits" sub="Small daily choices. Changes save automatically.">Daily habits</PageTitle>
      <ErrorNote error={error} />
      {data && data.length > 0 && (
        <Card delay={40}><Progress label="Habits completed today" value={done} goal={data.length} unit="done" color="bg-gradient-to-r from-sky-400 to-brand-500" /></Card>
      )}
      {!data && <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((h, i) => (
          <section key={h.habit_id} style={{ animationDelay: `${80 + i * 50}ms` }}
            className={`relative animate-fade-up rounded-2xl border p-5 shadow-card transition ${h.done ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" : "border-slate-200/80 bg-white"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{h.name}</h2>
                <p className="text-xs text-ink-muted">Goal: {h.target} {h.unit}</p>
              </div>
              {h.done && <span className="animate-pop-in rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">✔ Done</span>}
            </div>
            <div className="relative mt-4 flex items-center justify-between gap-3">
              {celebrate[h.habit_id] && <Burst key={celebrate[h.habit_id]} count={10} spread={80} glyphs={["✨", "⭐", "🎉"]} />}
              {h.target === 1 ? (
                <button onClick={() => set(h, h.count >= 1 ? 0 : 1)} aria-pressed={h.count >= 1} aria-label={h.name}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition active:scale-[.97] ${
                    h.count >= 1 ? "bg-emerald-500 text-white" : "border border-dashed border-slate-300 text-ink-soft hover:border-emerald-400 hover:text-emerald-700"}`}>
                  {h.count >= 1 ? <><Check size={18} strokeWidth={3} /> Done</> : "Mark as done"}
                </button>
              ) : (
                <>
                  <button aria-label={`One less ${h.name}`} onClick={() => set(h, h.count - 1)}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-xl font-bold text-ink-soft hover:bg-slate-50 active:scale-90">−</button>
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-black tabular-nums">{h.count}<span className="text-base font-semibold text-ink-muted"> / {h.target}</span></p>
                    <div className="mx-auto mt-1 flex max-w-[10rem] justify-center gap-1" aria-hidden>
                      {Array.from({ length: Math.min(h.target, 12) }, (_, k) => (
                        <span key={k} className={`h-1.5 flex-1 rounded-full transition ${k < h.count ? "bg-sky-500" : "bg-slate-200"}`} />
                      ))}
                    </div>
                  </div>
                  <button aria-label={`One more ${h.name}`} onClick={() => set(h, h.count + 1)}
                    className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500 text-xl font-bold text-white shadow-md hover:bg-sky-600 active:scale-90">+</button>
                </>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
