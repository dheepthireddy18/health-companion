"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Close, Sparkles, Target } from "@/components/icons";
import { CountUp } from "@/components/ui";

interface Plan {
  calorie_goal: number; reason: string; source: "ai" | "formula";
  bmi: number; bmi_category: string; maintenance: number; range: [number, number];
}

/** One-time card after sign-up: the starting calorie goal worked out from height, weight and activity. */
export default function PlanWelcome() {
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => { try { const raw = sessionStorage.getItem("hc_new_plan"); if (raw) setPlan(JSON.parse(raw)); } catch {} }, []);
  if (!plan) return null;
  const dismiss = () => { try { sessionStorage.removeItem("hc_new_plan"); } catch {} setPlan(null); };

  return (
    <section aria-label="Your starting plan"
      className="relative animate-slide-in overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-brand-50 p-6 shadow-card">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-white"><Close size={16} /></button>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
        <Sparkles size={14} /> Your starting plan
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-4xl font-black tracking-tight"><CountUp value={plan.calorie_goal} duration={1200} /><span className="ml-1 text-base font-semibold text-ink-muted">kcal / day</span></p>
          <p className="text-xs text-ink-muted">Daily calorie goal</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold">{plan.bmi}</p>
          <p className="text-xs text-ink-muted">BMI · {plan.bmi_category}</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold">{plan.maintenance.toLocaleString()}</p>
          <p className="text-xs text-ink-muted">Estimated daily needs</p>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{plan.reason}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
          {plan.source === "ai" ? "✨ Suggested by AI within a safe range" : "Calculated with a standard formula"}
        </span>
        <button onClick={dismiss} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Looks good</button>
        <Link href="/track" onClick={dismiss} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Target size={15} /> Adjust my goal</Link>
      </div>
      <p className="mt-3 text-[0.7rem] text-ink-muted">A starting point, not medical advice. You and your clinician can change it any time.</p>
    </section>
  );
}
