"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({ title, right, children, className = "" }: {
  title?: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-teal-700 text-white hover:bg-teal-800",
  secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function Btn({ variant = "primary", className = "", ...props }: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className={`min-h-[3rem] rounded-xl px-5 py-2 text-base font-semibold disabled:opacity-50 ${variants[variant]} ${className}`} />
  );
}

const sev = [
  "bg-green-100 text-green-900 border-green-700",
  "bg-yellow-100 text-yellow-900 border-yellow-700",
  "bg-orange-100 text-orange-900 border-orange-700",
  "bg-red-100 text-red-900 border-red-700",
];
const sevIcon = ["✔", "!", "▲", "⚠"]; // shape + text, so colour is never the only signal

export function Pill({ severity, children }: { severity: number; children: ReactNode }) {
  const s = Math.min(3, severity);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-0.5 text-sm font-bold ${sev[s]}`}>
      <span aria-hidden>{sevIcon[s]}</span>{children}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-slate-600">{hint}</span>}
    </label>
  );
}

export function Progress({ label, value, goal, unit }: { label: string; value: number; goal: number; unit: string }) {
  const pct = goal ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="font-semibold">{label}</span>
        <span>{Math.round(value)} / {goal} {unit}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-slate-200" role="progressbar"
           aria-valuenow={Math.round(value)} aria-valuemax={goal} aria-label={label}>
        <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <header className="mb-2">
      <h1 className="text-3xl font-extrabold">{children}</h1>
      {sub && <p className="text-slate-700">{sub}</p>}
    </header>
  );
}

export const ErrorNote = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="rounded-xl border-l-8 border-red-700 bg-red-100 p-4 font-semibold text-red-900">{error}</p> : null;

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl bg-slate-100 p-4 text-slate-700">{children}</p>
);
