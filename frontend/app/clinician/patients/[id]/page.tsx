"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useOpenChat } from "@/components/ClinicianChatDock";
import SummaryBox from "@/components/SummaryBox";
import { Activity, Chat, ChevronLeft, Droplet, Flame, Heart, Phone, Scale, Target, Utensils } from "@/components/icons";
import { Avatar, Btn, Card, Empty, ErrorNote, Pill, Skeleton } from "@/components/ui";
import { localDate, niceDate, niceTime, useFetch } from "@/lib/api";
import type { Food, Records } from "@/lib/types";

const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="-mx-1 overflow-x-auto"><table className="w-full text-left text-sm">
    <thead><tr className="border-b border-slate-200">{head.map((h) =>
      <th key={h} className="px-1 pb-2 pr-4 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-muted">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100">{children}</tbody></table></div>
);
const Td = ({ children, className = "" }: { children: ReactNode; className?: string }) => <td className={`px-1 py-2 pr-4 ${className}`}>{children}</td>;

function foodByDay(food: Food[]) {
  const days = new Map<string, number>();
  food.forEach((f) => days.set(f.day, (days.get(f.day) ?? 0) + f.calories));
  return Array.from(days.entries());
}

export default function PatientDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const rec = useFetch<Records>(`/clinician/patients/${id}/records?days=30&today=${localDate()}`);
  const openChat = useOpenChat();
  const r = rec.data;

  return (
    <>
      <Link href="/clinician" className="inline-flex animate-fade-up items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> All patients
      </Link>
      <ErrorNote error={rec.error} />
      {!r && !rec.error && <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>}
      {r && (
        <>
          <Card delay={40}>
            <SummaryBox patientId={id} actions={<Btn size="sm" variant="secondary" onClick={() => openChat(id, r.patient.name)}><Chat size={15} /> Message</Btn>}>
              <div className="flex items-center gap-4">
                <Avatar name={r.patient.name} size={56} />
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">{r.patient.name}</h1>
                  <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
                    <span>{r.patient.age ?? "—"} yrs</span>
                    {r.patient.phone ? <a href={`tel:${r.patient.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700"><Phone size={13} />{r.patient.phone}</a> : <span>no phone</span>}
                  </p>
                </div>
              </div>
            </SummaryBox>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Mini icon={<Flame size={15} className="text-orange-500" />} label="Streak" value={`${r.streak.current} days`} sub={`best ${r.streak.longest}`} />
              <Mini icon={<Scale size={15} className="text-violet-500" />} label="Latest BMI" value={r.bmi[0] ? String(r.bmi[0].bmi) : "—"} sub={r.bmi[0]?.category} />
              <Mini icon={<Target size={15} className="text-brand-600" />} label="Calorie goal" value={`${r.patient.calorie_goal} kcal`} />
              <Mini icon={<Activity size={15} className="text-sky-500" />} label="Activity goal" value={`${r.patient.activity_goal_min} min/day`} />
            </div>
          </Card>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card delay={100} title="Blood pressure · 30 days" icon={<Heart size={16} className="text-rose-500" />}>
              {r.blood_pressure.length ? <Table head={["When", "Reading", "Status"]}>
                {r.blood_pressure.slice(0, 15).map((b) => <tr key={b.id}><Td className="text-ink-muted">{niceDate(b.measured_at)} {niceTime(b.measured_at)}</Td>
                  <Td><b className="tabular-nums">{b.systolic}/{b.diastolic}</b></Td><Td><Pill severity={b.severity}>{b.status}</Pill></Td></tr>)}
              </Table> : <Empty>No readings in this period.</Empty>}
            </Card>
            <Card delay={140} title="Blood sugar · 30 days" icon={<Droplet size={16} className="text-sky-500" />}>
              {r.glucose.length ? <Table head={["When", "mg/dL", "Taken", "Status"]}>
                {r.glucose.slice(0, 15).map((g) => <tr key={g.id}><Td className="text-ink-muted">{niceDate(g.measured_at)} {niceTime(g.measured_at)}</Td>
                  <Td><b className="tabular-nums">{g.value}</b></Td><Td className="capitalize">{g.context.replace("_", " ")}</Td><Td><Pill severity={g.severity}>{g.status}</Pill></Td></tr>)}
              </Table> : <Empty>No readings in this period.</Empty>}
            </Card>
            <Card delay={180} title="Calories eaten" icon={<Utensils size={16} className="text-brand-600" />}>
              {r.food.length ? <Table head={["Day", "Calories"]}>{foodByDay(r.food).slice(0, 10).map(([d, c]) =>
                <tr key={d}><Td className="text-ink-muted">{niceDate(d)}</Td><Td><b className="tabular-nums">{Math.round(c)}</b> kcal</Td></tr>)}</Table>
                : <Empty>No food logged in this period.</Empty>}
            </Card>
            <Card delay={220} title="Activity" icon={<Activity size={16} className="text-violet-500" />}>
              {r.activity.length ? <Table head={["Day", "Activity", "Min"]}>{r.activity.slice(0, 10).map((w) =>
                <tr key={w.id}><Td className="text-ink-muted">{niceDate(w.day)}</Td><Td className="capitalize">{w.kind}</Td><Td className="tabular-nums">{w.duration_min}</Td></tr>)}</Table>
                : <Empty>No activity logged in this period.</Empty>}
            </Card>
          </div>
          <Card delay={260} title="Body mass index" icon={<Scale size={16} className="text-violet-500" />}>
            {r.bmi.length ? <Table head={["Date", "BMI", "Category", "Weight"]}>{r.bmi.map((b) => <tr key={b.id}>
              <Td className="text-ink-muted">{niceDate(b.measured_at)}</Td><Td><b className="tabular-nums">{b.bmi}</b></Td><Td>{b.category}</Td><Td className="tabular-nums">{b.weight_kg} kg</Td></tr>)}</Table>
              : <Empty>No BMI records.</Empty>}
          </Card>
        </>
      )}
    </>
  );
}

function Mini({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-muted">{icon}{label}</p>
      <p className="mt-1 font-bold">{value}</p>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}
