"use client";
import { Card, Progress } from "@/components/ui";
import type { Energy } from "@/lib/types";

const label = { matched: "Matched ✔", over: "Over goal ▲", under: "Under goal" } as const;

/** Calories eaten minus calories burned, against the daily goal, plus suggestions when they do not match. */
export default function EnergyCard({ e }: { e: Energy }) {
  return (
    <Card title="Calories today" right={<span className="font-bold">{label[e.state]}</span>}>
      <div className="space-y-3">
        <Progress label="Net calories (eaten − burned)" value={Math.max(0, e.net)} goal={e.goal} unit="kcal" />
        <p>Eaten <b>{e.intake}</b> kcal · Burned by exercise <b>{e.burned}</b> kcal</p>
        <Progress label="Active minutes" value={e.active_min} goal={e.activity_goal_min} unit="min" />
        <ul className="list-disc space-y-1 pl-6">{e.suggestions.map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
    </Card>
  );
}
