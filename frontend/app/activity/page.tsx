"use client";
import { useState } from "react";
import EnergyCard from "@/components/EnergyCard";
import GoalInput from "@/components/GoalInput";
import { useAuth } from "@/components/AuthGate";
import { Btn, Card, Empty, ErrorNote, Field, PageTitle } from "@/components/ui";
import { del, localDate, patch, post, useFetch } from "@/lib/api";
import type { Energy, Workout } from "@/lib/types";

export default function ActivityPage() {
  const { user, refresh } = useAuth();
  const day = localDate();
  const kinds = useFetch<string[]>("/activity/kinds");
  const list = useFetch<Workout[]>(`/activity?day=${day}`);
  const energy = useFetch<Energy>(`/energy?day=${day}`);
  const [kind, setKind] = useState("brisk walk");
  const [minutes, setMinutes] = useState("30");
  const [intensity, setIntensity] = useState("moderate");
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); setError(null); list.reload(); energy.reload(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  };

  return (
    <>
      <PageTitle sub="Log what you did; we estimate the calories burned">Physical activity</PageTitle>
      <ErrorNote error={error || list.error} />
      <Card title="What did you do?">
        <div className="space-y-4">
          <Field label="Activity"><select value={kind} onChange={(e) => setKind(e.target.value)}>
            {(kinds.data ?? ["brisk walk"]).map((k) => <option key={k}>{k}</option>)}</select></Field>
          <Field label="Minutes"><input type="number" inputMode="numeric" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
          <Field label="How hard?"><select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            <option value="light">Light</option><option value="moderate">Moderate</option><option value="vigorous">Vigorous</option></select></Field>
          <Btn className="w-full" onClick={() => run(() => post("/activity", { kind, duration_min: Number(minutes), intensity, day }))}>Add activity</Btn>
        </div>
      </Card>
      <Card title="Today's activity">
        {list.data && list.data.length > 0 ? (
          <ul className="divide-y">{list.data.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-2">
              <span><b>{w.kind}</b> · {w.duration_min} min · {w.intensity}</span>
              <span className="flex items-center gap-3 whitespace-nowrap"><b>{Math.round(w.calories_burned)} kcal</b>
                <button aria-label={`Remove ${w.kind}`} className="min-h-[2.5rem] rounded-lg px-3 text-xl hover:bg-slate-200"
                  onClick={() => run(() => del(`/activity/${w.id}`))}>✕</button></span>
            </li>))}</ul>
        ) : <Empty>No activity logged yet today.</Empty>}
      </Card>
      {energy.data && <EnergyCard e={energy.data} />}
      <Card title="Goal">
        <GoalInput label="Daily activity goal" unit="minutes" min={0} max={300} value={user.activity_goal_min}
          onSave={async (n) => { await patch("/auth/me", { activity_goal_min: n }); await refresh(); energy.reload(); }} />
      </Card>
    </>
  );
}
