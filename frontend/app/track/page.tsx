"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import GoalInput from "@/components/GoalInput";
import { useToast } from "@/components/Toast";
import { Activity, Check, Droplet, Flame, Heart, Plus, Scale, Target, Trash, Utensils } from "@/components/icons";
import { Btn, Card, Chips, CountUp, Empty, Field, PageTitle, Pill, Progress, Ring, Stepper } from "@/components/ui";
import { del, localDate, localDateTime, niceDate, niceTime, patch, post, useFetch } from "@/lib/api";
import { sfx } from "@/lib/sound";
import type { BMI, BP, Energy, Food, FoodPreview, Glucose, Workout } from "@/lib/types";

type Meal = "breakfast" | "lunch" | "snack" | "dinner";
const MEALS: { value: Meal; label: string; icon: string }[] = [
  { value: "breakfast", label: "Breakfast", icon: "🌅" }, { value: "lunch", label: "Lunch", icon: "☀️" },
  { value: "snack", label: "Snack", icon: "🍎" }, { value: "dinner", label: "Dinner", icon: "🌙" },
];
const hourMeal = (): Meal => { const h = new Date().getHours(); return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 18 ? "snack" : "dinner"; };

const KIND_ICON: Record<string, string> = {
  walking: "🚶", "brisk walk": "🏃", jogging: "🏃‍♀️", cycling: "🚴", swimming: "🏊", yoga: "🧘", stretching: "🤸",
  "chair exercises": "🪑", "strength training": "🏋️", dancing: "💃", gardening: "🌱", housework: "🧹",
};
type Intensity = "light" | "moderate" | "vigorous";
type SugarCtx = "fasting" | "before_meal" | "after_meal" | "bedtime";

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Food, activity and health readings on one page, sharing one calorie picture at the top. */
export default function TrackPage() {
  const day = localDate();
  const energy = useFetch<Energy>(`/energy?day=${day}`);
  const sections = [
    { id: "food", label: "Food", icon: <Utensils size={15} /> },
    { id: "activity", label: "Activity", icon: <Activity size={15} /> },
    { id: "vitals", label: "Vitals", icon: <Heart size={15} /> },
  ];
  return (
    <>
      <PageTitle eyebrow="Track" sub="Food, movement and readings — all in one place."
        right={
          <nav aria-label="Sections" className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-slate-100 hover:text-ink">
                {s.icon}{s.label}
              </a>
            ))}
          </nav>
        }>
        Today&apos;s log
      </PageTitle>
      <EnergyOverview energy={energy.data} reload={energy.reload} day={day} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <FoodSection day={day} onChange={energy.reload} />
        <ActivitySection day={day} onChange={energy.reload} />
      </div>
      <Vitals />
    </>
  );
}

/* ---------- calorie picture ---------- */
function EnergyOverview({ energy: e, reload, day }: { energy: Energy | null; reload: () => void; day: string }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  if (!e) return <div className="h-48 animate-pulse rounded-3xl bg-white/70" />;
  const over = e.state === "over";
  const matched = async () => {
    try { await post(`/food/matched-goal?day=${day}`); sfx.chime(); toast("Nice! Logged that you matched your goal"); reload(); }
    catch (err) { toast(errText(err, "Could not save"), "error"); }
  };
  return (
    <section className="grid animate-fade-up gap-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card md:grid-cols-[auto_1fr_auto]" style={{ animationDelay: "60ms" }}
      aria-label="Calories today">
      <Ring value={Math.max(0, e.net)} goal={e.goal} size={150} stroke={14} color={over ? "#f59e0b" : "#10b98f"} label="Net calories against goal">
        <div>
          <p className="text-3xl font-black tracking-tight"><CountUp value={Math.max(0, e.net)} /></p>
          <p className="text-xs font-medium text-ink-muted">of {e.goal} kcal</p>
        </div>
      </Ring>
      <div className="flex flex-col justify-center gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Eaten", value: e.intake, icon: <Utensils size={15} />, cls: "text-brand-700 bg-brand-50" },
            { label: "Burned", value: e.burned, icon: <Flame size={15} />, cls: "text-orange-700 bg-orange-50" },
            { label: over ? "Over" : "Left", value: Math.abs(e.difference), icon: <Target size={15} />, cls: over ? "text-amber-700 bg-amber-50" : "text-violet-700 bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
              <span className={`inline-grid h-7 w-7 place-items-center rounded-lg ${s.cls}`}>{s.icon}</span>
              <p className="mt-2 text-xl font-extrabold"><CountUp value={s.value} /></p>
              <p className="text-xs text-ink-muted">{s.label} · kcal</p>
            </div>
          ))}
        </div>
        <Progress label="Active minutes" value={e.active_min} goal={e.activity_goal_min} unit="min" color="bg-gradient-to-r from-violet-400 to-violet-600" />
        {e.suggestions.length > 0 && <p className="text-sm text-ink-muted">💡 {e.suggestions[0]}</p>}
      </div>
      <div className="flex flex-col gap-3 md:w-56">
        <GoalInput label="Calorie goal" unit="kcal" min={800} max={4500} value={user.calorie_goal}
          onSave={async (n) => { await patch("/auth/me", { calorie_goal: n }); await refresh(); reload(); }} />
        <GoalInput label="Activity goal" unit="min" min={0} max={300} value={user.activity_goal_min}
          onSave={async (n) => { await patch("/auth/me", { activity_goal_min: n }); await refresh(); reload(); }} />
        <Btn variant="secondary" size="sm" onClick={matched} className="mt-auto"><Check size={16} /> I matched my goal</Btn>
      </div>
    </section>
  );
}

/* ---------- food ---------- */
function FoodSection({ day, onChange }: { day: string; onChange: () => void }) {
  const toast = useToast();
  const food = useFetch<Food[]>(`/food?day=${day}`);
  const [text, setText] = useState("");
  const [meal, setMeal] = useState<Meal>(hourMeal());
  const [preview, setPreview] = useState<FoodPreview | null>(null);

  // Typo check: show what we understood before anything is saved.
  useEffect(() => {
    if (!text.trim()) { setPreview(null); return; }
    const id = setTimeout(() => post<FoodPreview>("/food/preview", { text }).then(setPreview).catch(() => {}), 300);
    return () => clearTimeout(id);
  }, [text]);

  const canAdd = !!preview && preview.items.length > 0;
  const add = async () => {
    if (!canAdd) return;
    try {
      await post("/food", { text, meal_type: meal, day });
      sfx.pop(); toast(`Added ${preview!.total_calories} kcal to ${meal}`);
      setText(""); setPreview(null); food.reload(); onChange();
    } catch (e) { toast(errText(e, "Could not add food"), "error"); }
  };
  const remove = async (f: Food) => {
    try { await del(`/food/${f.id}`); food.reload(); onChange(); } catch (e) { toast(errText(e, "Could not remove"), "error"); }
  };

  const byMeal = useMemo(() => MEALS.map((m) => ({ ...m, items: (food.data ?? []).filter((f) => f.meal_type === m.value) }))
    .filter((m) => m.items.length), [food.data]);

  return (
    <Card id="food" delay={120} className="scroll-mt-24" title="Food" icon={<Utensils size={16} className="text-brand-600" />}
      right={<span className="text-sm text-ink-muted">Type it in your own words</span>}>
      <Chips label="Meal" options={MEALS} value={meal} onChange={setMeal} />
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 2 idli and a cup of dal" aria-label="What did you eat?" />
        <Btn type="submit" disabled={!canAdd} aria-label="Add food" className="shrink-0 !px-3.5"><Plus size={18} /> <span className="hidden sm:inline">Add</span></Btn>
      </form>
      {preview && (preview.items.length > 0 || preview.unmatched.length > 0) && (
        <div aria-live="polite" className="mt-3 flex flex-wrap items-center gap-1.5">
          {preview.items.map((i, k) => (
            <span key={`${i.name}${k}`} style={{ animationDelay: `${k * 40}ms` }}
              className="animate-pop-in rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-600/15">
              {i.quantity} × {i.name} <span className="font-normal text-brand-700/80">· {i.calories} kcal</span>
            </span>
          ))}
          {preview.unmatched.map((u) => (
            <span key={u} className="animate-pop-in rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
              ? {u} — check spelling
            </span>
          ))}
          {preview.items.length > 0 && <span className="ml-auto text-sm font-bold">{preview.total_calories} kcal</span>}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {food.data?.length === 0 && <Empty icon={<Utensils size={22} />}>Nothing logged yet today.</Empty>}
        {byMeal.map((m) => (
          <div key={m.value}>
            <p className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink-muted">
              <span>{m.icon} {m.label}</span>
              <span className="tabular-nums">{Math.round(m.items.reduce((a, f) => a + f.calories, 0))} kcal</span>
            </p>
            <ul className="space-y-1">
              {m.items.map((f) => (
                <li key={f.id} className="group flex animate-fade-up items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50">
                  <span className="text-sm"><b className="font-semibold capitalize">{f.name}</b>
                    {f.quantity !== 1 && f.source === "text" && <span className="text-ink-muted"> × {f.quantity}</span>}</span>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    <b>{Math.round(f.calories)}</b><span className="text-xs text-ink-muted">kcal</span>
                    <button aria-label={`Remove ${f.name}`} onClick={() => remove(f)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                      <Trash size={15} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- activity ---------- */
function ActivitySection({ day, onChange }: { day: string; onChange: () => void }) {
  const toast = useToast();
  const kinds = useFetch<string[]>("/activity/kinds");
  const list = useFetch<Workout[]>(`/activity?day=${day}`);
  const [kind, setKind] = useState("brisk walk");
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState<Intensity>("moderate");

  const add = async () => {
    try {
      const w = await post<Workout>("/activity", { kind, duration_min: minutes, intensity, day });
      sfx.pop(); toast(`${KIND_ICON[kind] ?? "💪"} ${minutes} min ${kind} · ${Math.round(w.calories_burned)} kcal burned`);
      list.reload(); onChange();
    } catch (e) { toast(errText(e, "Could not add activity"), "error"); }
  };
  const remove = async (w: Workout) => {
    try { await del(`/activity/${w.id}`); list.reload(); onChange(); } catch (e) { toast(errText(e, "Could not remove"), "error"); }
  };

  return (
    <Card id="activity" delay={180} className="scroll-mt-24" title="Activity" icon={<Activity size={16} className="text-violet-600" />}
      right={<span className="text-sm text-ink-muted">We estimate calories burned</span>}>
      <Chips label="Activity" value={kind} onChange={setKind}
        options={(kinds.data ?? ["brisk walk"]).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1), icon: KIND_ICON[k] }))} />
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-soft">Duration</p>
          <Stepper label="Minutes" unit="min" value={minutes} onChange={setMinutes} min={1} max={600} />
          <div className="mt-2 flex gap-1">
            {[15, 30, 45, 60].map((n) => (
              <button key={n} type="button" onClick={() => setMinutes(n)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${minutes === n ? "bg-violet-100 text-violet-800" : "text-ink-muted hover:bg-slate-100"}`}>{n}m</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-soft">How hard?</p>
          <Chips label="Intensity" value={intensity} onChange={setIntensity}
            options={[{ value: "light", label: "Light" }, { value: "moderate", label: "Moderate" }, { value: "vigorous", label: "Vigorous" }]} />
        </div>
      </div>
      <Btn className="mt-4 w-full !bg-none !bg-violet-600 !shadow-[0_8px_20px_-8px_rgba(124,58,237,.7)] hover:!bg-violet-700" onClick={add}>
        <Plus size={18} /> Add activity
      </Btn>

      <ul className="mt-5 space-y-1">
        {list.data?.length === 0 && <Empty icon={<Activity size={22} />}>No activity logged yet today.</Empty>}
        {list.data?.map((w) => (
          <li key={w.id} className="group flex animate-fade-up items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50">
            <span className="flex items-center gap-3 text-sm">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-lg" aria-hidden>{KIND_ICON[w.kind] ?? "💪"}</span>
              <span><b className="font-semibold capitalize">{w.kind}</b><span className="block text-xs capitalize text-ink-muted">{w.duration_min} min · {w.intensity}</span></span>
            </span>
            <span className="flex items-center gap-2 text-sm tabular-nums">
              <Flame size={14} className="text-orange-500" /><b>{Math.round(w.calories_burned)}</b><span className="text-xs text-ink-muted">kcal</span>
              <button aria-label={`Remove ${w.kind}`} onClick={() => remove(w)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                <Trash size={15} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------- vitals ---------- */
function Vitals() {
  const { user } = useAuth();
  const toast = useToast();
  const bmi = useFetch<BMI[]>("/bmi");
  const bp = useFetch<BP[]>("/bp");
  const sugar = useFetch<Glucose[]>("/glucose");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [glu, setGlu] = useState("");
  const [ctx, setCtx] = useState<SugarCtx>("fasting");
  const [height, setHeight] = useState(user.height_cm ? String(user.height_cm) : "");
  const [weight, setWeight] = useState("");

  const saveReading = async () => {
    const now = localDateTime();
    try {
      if (!sys && !dia && !glu) throw new Error("Enter a blood pressure or a sugar value");
      const parts: string[] = [];
      if (sys || dia) { const r = await post<BP>("/bp", { measured_at: now, systolic: Number(sys), diastolic: Number(dia) }); parts.push(`BP ${r.status}`); }
      if (glu) { const r = await post<Glucose>("/glucose", { measured_at: now, value: Number(glu), context: ctx }); parts.push(`sugar ${r.status}`); }
      sfx.pop(); toast(`Saved · ${parts.join(", ")}`);
      setSys(""); setDia(""); setGlu(""); bp.reload(); sugar.reload();
    } catch (e) { toast(errText(e, "Check the numbers"), "error"); }
  };
  const calcBmi = async () => {
    try {
      const r = await post<BMI>("/bmi", { height_cm: Number(height), weight_kg: Number(weight) });
      sfx.chime(); toast(`BMI ${r.bmi} · ${r.category}`); bmi.reload();
    } catch (e) { toast(errText(e, "Check your height and weight"), "error"); }
  };

  const readings = useMemo(() => [
    ...(bp.data ?? []).map((r) => ({ key: `b${r.id}`, at: r.measured_at, kind: "bp" as const, value: `${r.systolic}/${r.diastolic}`, unit: "mmHg", extra: "", status: r.status, severity: r.severity })),
    ...(sugar.data ?? []).map((r) => ({ key: `g${r.id}`, at: r.measured_at, kind: "sugar" as const, value: String(r.value), unit: "mg/dL", extra: r.context.replace("_", " "), status: r.status, severity: r.severity })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8), [bp.data, sugar.data]);

  const latest = bmi.data?.[0];
  return (
    <div id="vitals" className="grid scroll-mt-24 items-start gap-5 lg:grid-cols-5">
      <Card delay={220} className="lg:col-span-3" title="Blood pressure & sugar" icon={<Heart size={16} className="text-rose-500" />}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-soft">Blood pressure</p>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={sys} onChange={(e) => setSys(e.target.value)} placeholder="120" aria-label="Top number (systolic)" className="text-center text-lg font-bold" />
              <span className="text-2xl font-light text-slate-300">/</span>
              <input type="number" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="80" aria-label="Bottom number (diastolic)" className="text-center text-lg font-bold" />
            </div>
            <p className="mt-1 flex justify-between px-1 text-xs text-ink-muted"><span>top (systolic)</span><span>bottom (diastolic)</span></p>
          </div>
          <div>
            <Field label="Blood sugar (mg/dL)">
              <input type="number" inputMode="numeric" value={glu} onChange={(e) => setGlu(e.target.value)} placeholder="100" className="text-lg font-bold" />
            </Field>
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-soft">Sugar taken</p>
          <Chips label="Sugar taken" value={ctx} onChange={setCtx} options={[
            { value: "fasting", label: "Fasting" }, { value: "before_meal", label: "Before meal" },
            { value: "after_meal", label: "After meal" }, { value: "bedtime", label: "Bedtime" }]} />
        </div>
        <Btn className="mt-4 w-full !bg-none !bg-rose-500 !shadow-[0_8px_20px_-8px_rgba(244,63,94,.7)] hover:!bg-rose-600" onClick={saveReading}>Save reading</Btn>

        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Recent readings</p>
          {readings.length === 0 ? <Empty>No readings yet.</Empty> : (
            <ul className="divide-y divide-slate-100">
              {readings.map((r) => (
                <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${r.kind === "bp" ? "bg-rose-50 text-rose-500" : "bg-sky-50 text-sky-500"}`}>
                      {r.kind === "bp" ? <Heart size={15} /> : <Droplet size={15} />}
                    </span>
                    <span><b className="tabular-nums">{r.value}</b> <span className="text-xs text-ink-muted">{r.unit}{r.extra && ` · ${r.extra}`}</span>
                      <span className="block text-xs text-ink-muted">{niceDate(r.at)} · {niceTime(r.at)}</span></span>
                  </span>
                  <Pill severity={r.severity}>{r.status}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card delay={260} className="lg:col-span-2" title="BMI" icon={<Scale size={16} className="text-sky-600" />}>
        <BmiGauge value={latest?.bmi ?? null} />
        {latest && <p className="mt-2 text-center text-sm text-ink-muted">
          <b className="text-ink">{latest.bmi}</b> · {latest.category} · {niceDate(latest.measured_at)}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="Height (cm)"><input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="165" /></Field>
          <Field label="Weight (kg)"><input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="62" /></Field>
        </div>
        <Btn variant="dark" className="mt-4 w-full" disabled={!height || !weight} onClick={calcBmi}>Calculate BMI</Btn>
      </Card>
    </div>
  );
}

/** Coloured band from 15 to 40 with a marker that slides to the latest BMI. */
function BmiGauge({ value }: { value: number | null }) {
  const [pos, setPos] = useState(0);
  const pct = value === null ? 0 : Math.max(0, Math.min(100, ((value - 15) / 25) * 100));
  useEffect(() => { const id = requestAnimationFrame(() => setPos(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  const band = [{ w: 14, c: "bg-sky-400", l: "Under" }, { w: 26, c: "bg-emerald-400", l: "Healthy" }, { w: 20, c: "bg-amber-400", l: "Over" }, { w: 40, c: "bg-rose-400", l: "Obese" }];
  return (
    <div className="pt-8">
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-full">{band.map((b) => <div key={b.l} className={b.c} style={{ width: `${b.w}%` }} />)}</div>
        {value !== null && (
          <div className="absolute -top-8 -translate-x-1/2 transition-[left] duration-1000 ease-out" style={{ left: `${pos}%` }}>
            <span className="block rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-white">{value}</span>
            <span className="mx-auto block h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-ink" />
          </div>
        )}
      </div>
      <div className="mt-1.5 flex text-[0.65rem] font-semibold uppercase tracking-wider text-ink-muted">
        {band.map((b) => <span key={b.l} style={{ width: `${b.w}%` }}>{b.l}</span>)}
      </div>
    </div>
  );
}
