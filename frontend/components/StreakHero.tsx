"use client";
import { useEffect, useRef, useState } from "react";
import Burst from "@/components/Burst";
import { Check, Flame } from "@/components/icons";
import { useCountUp } from "@/components/ui";
import { addDays, localDate } from "@/lib/api";
import { motionAllowed } from "@/lib/prefs";
import { sfx } from "@/lib/sound";
import type { Streak } from "@/lib/types";

const WEEKDAY = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" });

/**
 * Duolingo-style streak: the flame flies into place while the number counts up with rising ticks,
 * then stars burst out and fade. A check-in replays the landing for the new value.
 */
export default function StreakHero({ s, onCheckIn, busy }: { s: Streak; onCheckIn: () => void; busy: boolean }) {
  const [target, setTarget] = useState(0);
  const [landed, setLanded] = useState(0); // bumps each time the count finishes, to re-fire the burst
  const [pulse, setPulse] = useState(0);
  const prev = useRef<number | null>(null);

  // Start the count shortly after the flame begins flying in; on later changes count from the old value.
  useEffect(() => {
    const first = prev.current === null;
    prev.current = s.current;
    if (first) { const id = setTimeout(() => setTarget(s.current), motionAllowed() ? 350 : 0); return () => clearTimeout(id); }
    setTarget(s.current);
    setPulse((p) => p + 1);
  }, [s.current]);

  const steps = Math.max(1, target);
  const shown = useCountUp(target, Math.min(1500, 450 + steps * 55),
    (n, t) => { if (steps <= 40 || n % Math.ceil(steps / 40) === 0) sfx.tick(t); },
    () => {
      if (target <= 0) return;
      setLanded((l) => l + 1);
      if (s.milestone) sfx.fanfare(); else sfx.chime();
    });

  const today = localDate();
  const end = s.checked_in_today ? today : addDays(today, -1);
  const streakStart = addDays(end, -(s.current - 1));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const toNext = s.next_milestone - s.current;
  const milestonePct = ((s.current % 5) / 5) * 100 || (s.current > 0 ? 100 : 0);

  return (
    <section aria-label="Check-in streak" style={{ animationDelay: "60ms" }}
      className="relative animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 via-rose-500 to-fuchsia-600 p-6 text-white shadow-lift">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-yellow-300/25 blur-2xl" />

      <div className="relative flex flex-wrap items-center gap-6">
        <div key={pulse} className="relative flex animate-streak-land items-center gap-3"
          style={{ ["--from-x" as string]: "60px", ["--from-y" as string]: "50px" }}>
          <span className="relative grid h-20 w-20 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <Flame size={46} className="animate-flicker fill-yellow-200 text-yellow-100 drop-shadow-[0_0_12px_rgba(253,224,71,.8)]" />
            {landed > 0 && <Burst key={landed} count={s.milestone ? 22 : 14} spread={s.milestone ? 170 : 120}
              glyphs={s.milestone ? ["🎉", "⭐", "🔥", "✨", "🏆"] : ["⭐", "🔥", "✨", "💫"]} />}
          </span>
          <div>
            <p className="text-6xl font-black leading-none tabular-nums tracking-tight drop-shadow-sm" aria-live="polite">
              {Math.round(shown)}
            </p>
            <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-white/85">day streak</p>
          </div>
        </div>

        <div className="ml-auto min-w-[230px] flex-1 sm:max-w-xs">
          <ol className="flex justify-between gap-1.5" aria-label="Last 7 days">
            {week.map((d, i) => {
              const on = s.current > 0 && d >= streakStart && d <= end;
              return (
                <li key={d} className="flex flex-col items-center gap-1.5">
                  <span className="text-[0.7rem] font-semibold text-white/75">{WEEKDAY(d)}</span>
                  <span style={{ animationDelay: `${500 + i * 90}ms` }}
                    className={`grid h-8 w-8 animate-pop-in place-items-center rounded-full text-sm ${
                      on ? "bg-white text-rose-500 shadow-md" : "bg-white/15 ring-1 ring-white/25"} ${d === today ? "outline outline-2 outline-offset-2 outline-white/60" : ""}`}>
                    {on ? <Check size={16} strokeWidth={3} /> : null}
                    <span className="sr-only">{d}{on ? ": checked in" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4">
            <div className="flex justify-between text-xs font-semibold text-white/85">
              <span>{s.milestone ? `🎉 ${s.current}-day milestone!` : `${toNext} day${toNext === 1 ? "" : "s"} to day ${s.next_milestone}`}</span>
              <span>Best {s.longest}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-200 to-white transition-[width] duration-1000 ease-out"
                style={{ width: `${target ? milestonePct : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      <button onClick={onCheckIn} disabled={busy || s.checked_in_today}
        className={`relative mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition active:scale-[.98] ${
          s.checked_in_today ? "cursor-default bg-white/20 text-white ring-1 ring-white/30" : "bg-white text-rose-600 shadow-lg hover:-translate-y-0.5 hover:shadow-xl"}`}>
        {s.checked_in_today ? <><Check size={18} strokeWidth={3} /> Checked in today — see you tomorrow</> : busy ? "Checking in…" : "Check in for today"}
      </button>
    </section>
  );
}
