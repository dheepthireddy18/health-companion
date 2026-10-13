"use client";
import { useEffect, useState } from "react";

/** Compact number box that saves itself when you leave it, so a goal never needs its own button. */
export default function GoalInput({ label, value, min, max, unit, onSave }: {
  label: string; value: number; min: number; max: number; unit: string; onSave: (n: number) => Promise<void>;
}) {
  const [text, setText] = useState(String(value));
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => setText(String(value)), [value]);

  const commit = async () => {
    const n = Number(text);
    if (!Number.isFinite(n) || n < min || n > max) { setNote({ text: `Enter ${min}–${max}`, ok: false }); setText(String(value)); return; }
    if (n === value) return;
    try { await onSave(n); setNote({ text: "Saved", ok: true }); setTimeout(() => setNote(null), 2000); }
    catch { setNote({ text: "Could not save", ok: false }); }
  };
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[0.8rem] font-semibold text-ink-soft">
        {label}
        {note && <span className={`animate-pop-in text-xs ${note.ok ? "text-brand-600" : "text-rose-600"}`}>{note.ok ? "✔ " : ""}{note.text}</span>}
      </span>
      <span className="relative block">
        <input type="number" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="!pr-14 font-semibold tabular-nums" />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{unit}</span>
      </span>
    </label>
  );
}
