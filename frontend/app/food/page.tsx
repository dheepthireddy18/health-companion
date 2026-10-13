"use client";
import { useEffect, useState } from "react";
import EnergyCard from "@/components/EnergyCard";
import GoalInput from "@/components/GoalInput";
import { useAuth } from "@/components/AuthGate";
import { Btn, Card, Empty, ErrorNote, Field, PageTitle } from "@/components/ui";
import { del, localDate, patch, post, useFetch } from "@/lib/api";
import type { Energy, Food, FoodPreview } from "@/lib/types";

const hourMeal = () => { const h = new Date().getHours(); return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "snack" : "dinner"; };

export default function FoodPage() {
  const { user, refresh } = useAuth();
  const day = localDate();
  const food = useFetch<Food[]>(`/food?day=${day}`);
  const energy = useFetch<Energy>(`/energy?day=${day}`);
  const [text, setText] = useState("");
  const [meal, setMeal] = useState(hourMeal());
  const [preview, setPreview] = useState<FoodPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Typo check: show what we understood before anything is saved.
  useEffect(() => {
    if (!text.trim()) { setPreview(null); return; }
    const id = setTimeout(() => post<FoodPreview>("/food/preview", { text }).then(setPreview).catch(() => {}), 300);
    return () => clearTimeout(id);
  }, [text]);

  const reloadAll = () => { food.reload(); energy.reload(); };
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); setError(null); reloadAll(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  };
  const add = () => run(async () => { await post("/food", { text, meal_type: meal, day }); setText(""); setPreview(null); });

  return (
    <>
      <PageTitle sub="Say what you ate, and we work out the calories">Food</PageTitle>
      <ErrorNote error={error || food.error} />
      <Card title="What did you eat?">
        <div className="space-y-4">
          <Field label="Meal"><select value={meal} onChange={(e) => setMeal(e.target.value)}>
            {["breakfast", "lunch", "snack", "dinner"].map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
          </select></Field>
          <Field label="Type it in your own words" hint="Example: 2 idli and a cup of dal, an apple">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="2 idli and a cup of dal" />
          </Field>
          {preview && (
            <div aria-live="polite" className="rounded-xl bg-slate-100 p-3">
              {preview.items.map((i, k) => <p key={k}>{i.quantity} × {i.name} ({i.serving}) — <b>{i.calories} kcal</b></p>)}
              {preview.items.length > 0 && <p className="font-bold">Total: {preview.total_calories} kcal</p>}
              {preview.unmatched.length > 0 && <p className="font-semibold text-red-800">Not recognised: {preview.unmatched.join(", ")}. Check the spelling.</p>}
            </div>
          )}
          <Btn onClick={add} disabled={!preview || preview.items.length === 0} className="w-full">Add food</Btn>
        </div>
      </Card>
      <Card title="Today's food">
        {food.data && food.data.length > 0 ? (
          <ul className="divide-y">{food.data.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2">
              <span><b>{f.name}</b>{f.quantity !== 1 && f.source === "text" ? ` × ${f.quantity}` : ""} <span className="text-slate-600">({f.meal_type})</span></span>
              <span className="flex items-center gap-3 whitespace-nowrap"><b>{Math.round(f.calories)} kcal</b>
                <button aria-label={`Remove ${f.name}`} className="min-h-[2.5rem] rounded-lg px-3 text-xl hover:bg-slate-200"
                  onClick={() => run(() => del(`/food/${f.id}`))}>✕</button></span>
            </li>))}</ul>
        ) : <Empty>Nothing logged yet today.</Empty>}
      </Card>
      {energy.data && <EnergyCard e={energy.data} />}
      <Card title="Goal">
        <GoalInput label="Daily calorie goal" unit="kcal" min={800} max={4500} value={user.calorie_goal}
          onSave={async (n) => { await patch("/auth/me", { calorie_goal: n }); await refresh(); energy.reload(); }} />
      </Card>
      <Btn variant="secondary" className="w-full" onClick={() => run(() => post(`/food/matched-goal?day=${day}`))}>
        ✔ My calories matched my goal today
      </Btn>
    </>
  );
}
