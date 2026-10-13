"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import StreakHero from "@/components/StreakHero";
import { useToast } from "@/components/Toast";
import { Activity, CheckCircle, ChevronRight, Flame, Pill, Sparkles, Utensils, Zap } from "@/components/icons";
import { Card, CountUp, ErrorNote, PageTitle, Ring, Skeleton } from "@/components/ui";
import { localDate, post, to12h, useFetch } from "@/lib/api";
import type { DoseRow, HabitRow, Home } from "@/lib/types";

const tone = {
  green: { box: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white", dot: "bg-emerald-500", text: "text-emerald-800", word: "Doing well" },
  amber: { box: "border-amber-200 bg-gradient-to-br from-amber-50 to-white", dot: "bg-amber-500", text: "text-amber-800", word: "Keep an eye" },
  red: { box: "border-rose-200 bg-gradient-to-br from-rose-50 to-white", dot: "bg-rose-500", text: "text-rose-800", word: "Needs attention" },
};

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function TodayPage() {
  const { user } = useAuth();
  const toast = useToast();
  const day = localDate();
  const { data, error, reload } = useFetch<Home>(`/home?day=${day}`);
  const doses = useFetch<DoseRow[]>(`/medications/schedule?day=${day}`);
  const habits = useFetch<HabitRow[]>(`/habits?day=${day}`);
  const [busy, setBusy] = useState(false);

  const checkIn = async () => {
    setBusy(true);
    try { await post(`/checkin?day=${day}`); await reload(); toast("Checked in — streak extended!"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not check in", "error"); }
    finally { setBusy(false); }
  };

  const e = data?.energy;
  const t = data ? tone[data.status.level] : null;
  const nextDose = doses.data?.find((d) => d.status === "pending");
  const dosesTaken = doses.data?.filter((d) => d.status === "taken").length ?? 0;
  const habitsDone = habits.data?.filter((h) => h.done).length ?? 0;

  return (
    <>
      <PageTitle eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        sub="Here's your day at a glance.">
        {greeting()}, {user.name.split(" ")[0]} <span className="inline-block origin-[70%_70%] animate-wave">👋</span>
      </PageTitle>
      <ErrorNote error={error} />

      {!data ? (
        <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2"><StreakHero s={data.streak} onCheckIn={checkIn} busy={busy} /></div>

          <section aria-label="Today's status" style={{ animationDelay: "120ms" }}
            className={`flex animate-fade-up flex-col rounded-3xl border p-6 shadow-card ${t!.box}`}>
            <p className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${t!.text}`}>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full animate-ping-soft rounded-full ${t!.dot}`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${t!.dot}`} />
              </span>
              {data.status.level === "green" ? "✔" : data.status.level === "amber" ? "!" : "⚠"} {t!.word}
            </p>
            <p className="mt-3 text-[1.05rem] font-semibold leading-snug">{data.status.text}</p>
            <Link href="/track#vitals" className={`mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold ${t!.text} hover:underline`}>
              Log a reading <ChevronRight size={16} />
            </Link>
          </section>
        </div>
      )}

      {e && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <Card delay={160} className="flex items-center gap-4">
            <Ring value={Math.max(0, e.net)} goal={e.goal} size={84} stroke={9} label="Net calories against goal"
              color={e.state === "over" ? "#f59e0b" : "#10b98f"}>
              <Utensils size={20} className="text-ink-muted" />
            </Ring>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Net calories</p>
              <p className="text-2xl font-extrabold"><CountUp value={Math.max(0, e.net)} /><span className="text-sm font-medium text-ink-muted"> / {e.goal}</span></p>
              <p className="text-xs text-ink-muted">{e.state === "matched" ? "Right on target ✔" : e.state === "over" ? `${Math.abs(e.difference)} over goal` : `${Math.abs(e.difference)} left today`}</p>
            </div>
          </Card>
          <Card delay={200} className="flex items-center gap-4">
            <Ring value={e.active_min} goal={e.activity_goal_min} size={84} stroke={9} color="#8b5cf6" label="Active minutes against goal">
              <Activity size={20} className="text-ink-muted" />
            </Ring>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Active</p>
              <p className="text-2xl font-extrabold"><CountUp value={e.active_min} /><span className="text-sm font-medium text-ink-muted"> / {e.activity_goal_min} min</span></p>
              <p className="text-xs text-ink-muted"><Flame size={12} className="inline text-orange-500" /> {e.burned} kcal burned</p>
            </div>
          </Card>
          <Card delay={240} className="flex items-center gap-4">
            <span className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600"><Pill size={30} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Medicines</p>
              <p className="text-2xl font-extrabold">{dosesTaken}<span className="text-sm font-medium text-ink-muted"> / {doses.data?.length ?? 0} taken</span></p>
              <Link href="/medicines" className="text-xs font-semibold text-sky-700 hover:underline">
                {nextDose ? `Next: ${nextDose.name} at ${to12h(nextDose.slot)}` : doses.data?.length ? "All done for today ✔" : "Add a medicine →"}
              </Link>
            </div>
          </Card>
          <Card delay={280} className="flex items-center gap-4">
            <Ring value={habitsDone} goal={habits.data?.length || 1} size={84} stroke={9} color="#0ea5e9" label="Habits done">
              <CheckCircle size={20} className="text-ink-muted" />
            </Ring>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Habits</p>
              <p className="text-2xl font-extrabold">{habitsDone}<span className="text-sm font-medium text-ink-muted"> / {habits.data?.length ?? 0}</span></p>
              <Link href="/habits" className="text-xs font-semibold text-sky-700 hover:underline">Update habits →</Link>
            </div>
          </Card>
        </div>
      )}

      {e && e.suggestions.length > 0 && (
        <Card delay={320} title="Tips for today" icon={<Sparkles size={16} className="text-violet-500" />}
          right={<Link href="/track" className="text-sm font-semibold text-brand-700 hover:underline">Open tracker →</Link>}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {e.suggestions.map((s, i) => (
              <li key={s} style={{ animationDelay: `${360 + i * 60}ms` }}
                className="flex animate-fade-up items-start gap-2.5 rounded-xl bg-violet-50/60 p-3 text-sm text-ink-soft">
                <Zap size={16} className="mt-0.5 shrink-0 text-violet-500" />{s}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
