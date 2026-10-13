"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { motionAllowed } from "@/lib/prefs";

/* ---------- layout ---------- */
export function Card({ title, icon, right, children, className = "", delay = 0, id }: {
  title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; delay?: number; id?: string;
}) {
  return (
    <section id={id} style={{ animationDelay: `${delay}ms` }}
      className={`animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-2.5 text-[1.02rem] font-bold tracking-tight">
              {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-ink-soft">{icon}</span>}
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ children, sub, eyebrow, right }: { children: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex animate-fade-up flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>}
        <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{children}</h1>
        {sub && <p className="mt-1 text-ink-muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

/* ---------- controls ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgba(255,255,255,.25)_inset,0_8px_20px_-8px_rgba(5,150,116,.7)] hover:from-brand-500 hover:to-brand-700",
  secondary: "border border-slate-200 bg-white text-ink shadow-sm hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-ink-soft hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  dark: "bg-ink text-white hover:bg-slate-800",
};
const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[0.95rem]", lg: "h-12 px-6 text-base" };

export function Btn({ variant = "primary", size = "md", className = "", ...props }:
  { variant?: Variant; size?: keyof typeof sizes } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition duration-150
        active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`} />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export interface ChipOption<T extends string> { value: T; label: string; icon?: ReactNode }
/** Single-choice chips; a friendlier stand-in for short <select>s. */
export function Chips<T extends string>({ options, value, onChange, label, className = "" }: {
  options: ChipOption<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition
              ${on ? "border-ink bg-ink text-white shadow-sm" : "border-slate-200 bg-white text-ink-soft hover:border-slate-300 hover:text-ink"}`}>
            {o.icon && <span aria-hidden>{o.icon}</span>}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- status ---------- */
const sev = [
  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "bg-amber-50 text-amber-700 ring-amber-600/20",
  "bg-orange-50 text-orange-700 ring-orange-600/25",
  "bg-rose-50 text-rose-700 ring-rose-600/25",
];
const sevIcon = ["✔", "!", "▲", "⚠"]; // shape + text, so colour is never the only signal

export function Pill({ severity, children }: { severity: number; children: ReactNode }) {
  const s = Math.max(0, Math.min(3, severity));
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${sev[s]}`}>
      <span aria-hidden>{sevIcon[s]}</span>{children}
    </span>
  );
}

export const ErrorNote = ({ error }: { error: string | null | undefined }) =>
  error ? (
    <p role="alert" className="animate-slide-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
      {error}
    </p>
  ) : null;

export const Empty = ({ children, icon }: { children: ReactNode; icon?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-ink-muted">
    {icon && <span className="text-slate-400">{icon}</span>}
    {children}
  </div>
);

export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-shimmer rounded-xl bg-[linear-gradient(90deg,#eef2f6_25%,#f8fafc_50%,#eef2f6_75%)] bg-[length:200%_100%] ${className}`} />
);

export function Avatar({ name, size = 36, className = "" }: { name: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))` }}>
      {initials}
    </span>
  );
}

/* ---------- numbers that move ---------- */
/** Animates from 0 (or the previous value) to target with ease-out; onStep fires on each whole-number change, onDone at the end. */
export function useCountUp(target: number, duration = 900, onStep?: (n: number, progress: number) => void, onDone?: () => void) {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  const cb = useRef({ onStep, onDone });
  cb.current = { onStep, onDone };
  useEffect(() => {
    if (!motionAllowed()) { setVal(target); from.current = target; cb.current.onDone?.(); return; }
    const start = performance.now(), a = from.current;
    let last = Math.round(a), raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = a + (target - a) * (1 - Math.pow(1 - t, 3));
      setVal(v);
      if (Math.round(v) !== last) { last = Math.round(v); cb.current.onStep?.(last, t); }
      if (t < 1) raf = requestAnimationFrame(frame);
      else { from.current = target; cb.current.onDone?.(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function CountUp({ value, duration, className }: { value: number; duration?: number; className?: string }) {
  const v = useCountUp(value, duration);
  return <span className={`tabular-nums ${className ?? ""}`}>{Math.round(v).toLocaleString()}</span>;
}

/** Fills from zero after mount so the bar visibly grows into place. */
function useGrow(pct: number) {
  const [p, setP] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setP(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return p;
}

export function Progress({ label, value, goal, unit, color = "bg-brand-500" }: {
  label: string; value: number; goal: number; unit: string; color?: string;
}) {
  const pct = useGrow(goal ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className="tabular-nums text-ink-muted"><b className="text-ink">{Math.round(value)}</b> / {goal} {unit}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar"
        aria-valuenow={Math.round(value)} aria-valuemax={goal} aria-label={label}>
        <div className={`h-full rounded-full ${color} transition-[width] duration-1000 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Circular progress. `over` turns the ring amber when the value passes the goal. */
export function Ring({ value, goal, size = 112, stroke = 10, color = "#10b98f", track = "#eef2f6", children, label, style }: {
  value: number; goal: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label: string; style?: CSSProperties;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = useGrow(goal ? Math.max(0, Math.min(1, value / goal)) : 0);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size, ...style }}
      role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemax={goal}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Minus / number / plus with quick presets — faster than typing on a phone. */
export function Stepper({ value, onChange, min, max, step = 5, label, unit }: {
  value: number; onChange: (n: number) => void; min: number; max: number; step?: number; label: string; unit: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label}`} onClick={() => onChange(clamp(value - step))}
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-ink-soft transition hover:bg-slate-50 active:scale-95">−</button>
      <div className="relative w-24">
        <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))} className="!pr-10 text-center font-semibold tabular-nums" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{unit}</span>
      </div>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(clamp(value + step))}
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-lg font-bold text-ink-soft transition hover:bg-slate-50 active:scale-95">+</button>
    </div>
  );
}

/** Pretty on/off switch backed by a real checkbox for keyboard and screen readers. */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
