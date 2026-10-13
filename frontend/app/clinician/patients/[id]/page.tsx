"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import SummaryBox from "@/components/SummaryBox";
import { Btn, Card, Empty, ErrorNote, PageTitle, Pill } from "@/components/ui";
import { localDate, niceDate, niceTime, post, useFetch } from "@/lib/api";
import type { ChatMessage, Food, Records } from "@/lib/types";

const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="overflow-x-auto"><table className="w-full text-left">
    <thead><tr className="border-b-2">{head.map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead>
    <tbody>{children}</tbody></table></div>
);

function foodByDay(food: Food[]) {
  const days = new Map<string, number>();
  food.forEach((f) => days.set(f.day, (days.get(f.day) ?? 0) + f.calories));
  return Array.from(days.entries());
}

export default function PatientDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const rec = useFetch<Records>(`/clinician/patients/${id}/records?days=30&today=${localDate()}`);
  const chat = useFetch<ChatMessage[]>(`/clinician/patients/${id}/messages`);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const r = rec.data;

  const send = async () => {
    try { await post(`/clinician/patients/${id}/messages`, { body: reply }); setReply(""); setErr(null); chat.reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not send"); }
  };

  return (
    <>
      <Link href="/clinician" className="font-semibold text-teal-800 underline">← All patients</Link>
      <ErrorNote error={rec.error} />
      {r && (
        <>
          <Card>
            <SummaryBox patientId={id}>
              <PageTitle sub={`${r.patient.age ?? "—"} yrs · ${r.patient.phone ?? "no phone"} · goals ${r.patient.calorie_goal} kcal, ${r.patient.activity_goal_min} min/day`}>{r.patient.name}</PageTitle>
            </SummaryBox>
            <p className="mt-2">🔥 Streak {r.streak.current} days (best {r.streak.longest}) · Latest BMI {r.bmi[0] ? <b>{r.bmi[0].bmi} ({r.bmi[0].category})</b> : "—"}</p>
          </Card>
          <Card title="Blood pressure (30 days)">
            {r.blood_pressure.length ? <Table head={["When", "Reading", "Status"]}>
              {r.blood_pressure.slice(0, 15).map((b) => <tr key={b.id} className="border-b"><td className="py-1 pr-4">{niceDate(b.measured_at)} {niceTime(b.measured_at)}</td>
                <td className="pr-4"><b>{b.systolic}/{b.diastolic}</b></td><td><Pill severity={b.severity}>{b.status}</Pill></td></tr>)}
            </Table> : <Empty>No readings in this period.</Empty>}
          </Card>
          <Card title="Blood sugar (30 days)">
            {r.glucose.length ? <Table head={["When", "mg/dL", "Taken", "Status"]}>
              {r.glucose.slice(0, 15).map((g) => <tr key={g.id} className="border-b"><td className="py-1 pr-4">{niceDate(g.measured_at)} {niceTime(g.measured_at)}</td>
                <td className="pr-4"><b>{g.value}</b></td><td className="pr-4">{g.context.replace("_", " ")}</td><td><Pill severity={g.severity}>{g.status}</Pill></td></tr>)}
            </Table> : <Empty>No readings in this period.</Empty>}
          </Card>
          <Card title="Food and activity (recent days)">
            <div className="grid gap-6 md:grid-cols-2">
              <Table head={["Day", "Calories eaten"]}>{foodByDay(r.food).slice(0, 10).map(([d, c]) =>
                <tr key={d} className="border-b"><td className="py-1 pr-4">{niceDate(d)}</td><td>{Math.round(c)} kcal</td></tr>)}</Table>
              <Table head={["Day", "Activity", "Min"]}>{r.activity.slice(0, 10).map((w) =>
                <tr key={w.id} className="border-b"><td className="py-1 pr-4">{niceDate(w.day)}</td><td className="pr-4">{w.kind}</td><td>{w.duration_min}</td></tr>)}</Table>
            </div>
          </Card>
          <Card title="Body mass index">
            <Table head={["Date", "BMI", "Category", "Weight"]}>{r.bmi.map((b) => <tr key={b.id} className="border-b">
              <td className="py-1 pr-4">{niceDate(b.measured_at)}</td><td className="pr-4"><b>{b.bmi}</b></td><td className="pr-4">{b.category}</td><td>{b.weight_kg} kg</td></tr>)}</Table>
          </Card>
        </>
      )}
      <Card title="Messages">
        <div className="mb-3 max-h-72 space-y-2 overflow-y-auto">
          {(chat.data ?? []).map((m) => (
            <p key={m.id} className={`rounded-xl p-2 ${m.from_role === "clinician" ? "ml-8 bg-teal-100" : "mr-8 bg-slate-100"}`}>
              <span className="block text-xs text-slate-600">{m.sender} · {niceDate(m.created_at)} {niceTime(m.created_at)}</span>{m.body}</p>))}
          {chat.data?.length === 0 && <Empty>No messages yet.</Empty>}
        </div>
        <ErrorNote error={err} />
        <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" placeholder="Write a reply" />
        <Btn className="mt-3 w-full" disabled={!reply.trim()} onClick={send}>Send reply</Btn>
      </Card>
    </>
  );
}
