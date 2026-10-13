"use client";
import { useState } from "react";
import { Btn, Card, Empty, ErrorNote, Field, PageTitle, Pill } from "@/components/ui";
import { localDateTime, niceDate, niceTime, post, useFetch } from "@/lib/api";
import type { BMI, BP, Glucose } from "@/lib/types";

export default function HealthPage() {
  const bmi = useFetch<BMI[]>("/bmi");
  const bp = useFetch<BP[]>("/bp");
  const sugar = useFetch<Glucose[]>("/glucose");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [glu, setGlu] = useState("");
  const [ctx, setCtx] = useState("fasting");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const calcBmi = async () => {
    try {
      const r = await post<BMI>("/bmi", { height_cm: Number(height), weight_kg: Number(weight) });
      setDone(`Your BMI is ${r.bmi} (${r.category}).`); setError(null); bmi.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Check your height and weight"); }
  };
  const saveReading = async () => {
    const now = localDateTime();
    try {
      if (!sys && !dia && !glu) throw new Error("Enter a blood pressure or a sugar value");
      if (sys || dia) await post("/bp", { measured_at: now, systolic: Number(sys), diastolic: Number(dia) });
      if (glu) await post("/glucose", { measured_at: now, value: Number(glu), context: ctx });
      setSys(""); setDia(""); setGlu(""); setError(null); setDone("Reading saved."); bp.reload(); sugar.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Check the numbers"); }
  };

  const latest = bmi.data?.[0];
  return (
    <>
      <PageTitle sub="Body measurements and readings">Health</PageTitle>
      <ErrorNote error={error} />
      {done && <p role="status" className="rounded-xl bg-green-100 p-3 font-semibold text-green-900">{done}</p>}
      <Card title="BMI calculator">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Height (cm)"><input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
          <Field label="Weight (kg)"><input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        </div>
        {latest && <p className="mt-3">Last result: <b>{latest.bmi}</b> ({latest.category}) on {niceDate(latest.measured_at)}</p>}
        <Btn className="mt-4 w-full" onClick={calcBmi}>Calculate BMI</Btn>
      </Card>
      <Card title="Blood pressure and sugar">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Top number (systolic)"><input type="number" inputMode="numeric" value={sys} onChange={(e) => setSys(e.target.value)} /></Field>
          <Field label="Bottom number (diastolic)"><input type="number" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
          <Field label="Blood sugar (mg/dL)"><input type="number" inputMode="numeric" value={glu} onChange={(e) => setGlu(e.target.value)} /></Field>
          <Field label="Sugar taken"><select value={ctx} onChange={(e) => setCtx(e.target.value)}>
            <option value="fasting">Fasting</option><option value="before_meal">Before a meal</option>
            <option value="after_meal">After a meal</option><option value="bedtime">At bedtime</option></select></Field>
        </div>
        <Btn className="mt-4 w-full" onClick={saveReading}>Save reading</Btn>
      </Card>
      <Card title="Recent readings">
        {(bp.data?.length || sugar.data?.length) ? (
          <ul className="divide-y">
            {(bp.data ?? []).slice(0, 5).map((r) => (
              <li key={`b${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{niceDate(r.measured_at)} {niceTime(r.measured_at)} · <b>{r.systolic}/{r.diastolic}</b></span><Pill severity={r.severity}>{r.status}</Pill></li>))}
            {(sugar.data ?? []).slice(0, 5).map((r) => (
              <li key={`g${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{niceDate(r.measured_at)} {niceTime(r.measured_at)} · <b>{r.value} mg/dL</b> ({r.context.replace("_", " ")})</span><Pill severity={r.severity}>{r.status}</Pill></li>))}
          </ul>
        ) : <Empty>No readings yet.</Empty>}
      </Card>
    </>
  );
}
