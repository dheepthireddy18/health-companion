"use client";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui";

/** Number box that saves itself when you leave it, so a goal never needs its own button. */
export default function GoalInput({ label, value, min, max, unit, onSave }: {
  label: string; value: number; min: number; max: number; unit: string; onSave: (n: number) => Promise<void>;
}) {
  const [text, setText] = useState(String(value));
  const [note, setNote] = useState("Saves automatically");
  useEffect(() => setText(String(value)), [value]);

  const commit = async () => {
    const n = Number(text);
    if (!Number.isFinite(n) || n < min || n > max) { setNote(`Enter ${min}–${max}`); setText(String(value)); return; }
    if (n === value) return;
    try { await onSave(n); setNote("Saved ✔"); } catch { setNote("Could not save"); }
  };
  return (
    <Field label={`${label} (${unit})`} hint={note}>
      <input type="number" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
    </Field>
  );
}
