"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useOpenChat } from "@/components/ClinicianChatDock";
import SummaryBox from "@/components/SummaryBox";
import { Alert, Chat, Droplet, Flame, Heart, Pill as PillIcon, Scale, Search, Users } from "@/components/icons";
import { Avatar, Btn, Chips, CountUp, Empty, ErrorNote, PageTitle, Pill, Skeleton } from "@/components/ui";
import { localDate, niceDate, useFetch } from "@/lib/api";
import type { PatientRow } from "@/lib/types";

export default function PatientList() {
  const { data, error } = useFetch<PatientRow[]>(`/clinician/patients?today=${localDate()}`);
  const openChat = useOpenChat();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "attention">("all");

  const rows = useMemo(() => (data ?? []).filter((p) =>
    p.name.toLowerCase().includes(q.trim().toLowerCase()) && (filter === "all" || p.attention >= 2)), [data, q, filter]);
  const attention = data?.filter((p) => p.attention >= 2).length ?? 0;
  const adherence = data?.filter((p) => p.med_adherence_7d !== null) ?? [];
  const avgAdherence = adherence.length ? Math.round(adherence.reduce((a, p) => a + (p.med_adherence_7d ?? 0), 0) / adherence.length) : 0;
  const active = data?.filter((p) => p.streak > 0).length ?? 0;

  return (
    <>
      <PageTitle eyebrow="Clinician" sub="Patients who need attention are listed first.">Your patients</PageTitle>
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi delay={40} icon={<Users size={18} />} tone="bg-slate-100 text-ink-soft" label="Patients" value={data?.length ?? 0} />
        <Kpi delay={80} icon={<Alert size={18} />} tone="bg-rose-50 text-rose-600" label="Need attention" value={attention} />
        <Kpi delay={120} icon={<Flame size={18} />} tone="bg-orange-50 text-orange-600" label="Active streaks" value={active} />
        <Kpi delay={160} icon={<PillIcon size={18} />} tone="bg-sky-50 text-sky-600" label="Avg. adherence (7d)" value={avgAdherence} suffix="%" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients" aria-label="Search patients" className="!pl-10" />
        </div>
        <Chips label="Filter" value={filter} onChange={setFilter}
          options={[{ value: "all", label: "All" }, { value: "attention", label: `Needs attention · ${attention}` }]} />
      </div>

      {!data && <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {data && rows.length === 0 && <Empty icon={<Users size={22} />}>No patients match.</Empty>}
      <div className="space-y-4">
        {rows.map((p, i) => (
          <article key={p.id} style={{ animationDelay: `${200 + i * 50}ms` }}
            className={`animate-fade-up rounded-2xl border bg-white p-5 shadow-card transition hover:shadow-lift ${p.attention >= 3 ? "border-rose-200" : p.attention === 2 ? "border-orange-200" : "border-slate-200/80"}`}>
            <SummaryBox patientId={p.id}
              actions={<Btn size="sm" variant="secondary" onClick={() => openChat(p.id)} aria-label={`Message ${p.name}`}><Chat size={15} /> <span className="hidden sm:inline">Message</span></Btn>}>
              <Link href={`/clinician/patients/${p.id}`} className="group flex items-center gap-3">
                <Avatar name={p.name} size={44} />
                <span>
                  <span className="flex items-center gap-2 text-lg font-bold group-hover:text-brand-700">
                    {p.name}
                    {p.attention >= 2 && <span className={`h-2 w-2 rounded-full ${p.attention >= 3 ? "bg-rose-500" : "bg-orange-500"}`} aria-label="Needs attention" />}
                  </span>
                  <span className="block text-xs text-ink-muted">{p.age ? `${p.age} yrs · ` : ""}Last check-in {p.last_check_in ? niceDate(p.last_check_in) : "never"}</span>
                </span>
              </Link>
            </SummaryBox>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat icon={<Heart size={14} className="text-rose-500" />} label="Blood pressure">
                {p.latest_bp ? <><b>{p.latest_bp.value}</b> <Pill severity={p.latest_bp.severity}>{p.latest_bp.status}</Pill></> : "—"}
              </Stat>
              <Stat icon={<Droplet size={14} className="text-sky-500" />} label="Blood sugar">
                {p.latest_glucose ? <><b>{p.latest_glucose.value}</b> <Pill severity={p.latest_glucose.severity}>{p.latest_glucose.status}</Pill></> : "—"}
              </Stat>
              <Stat icon={<Scale size={14} className="text-violet-500" />} label="Latest BMI">{p.latest_bmi ? <b>{p.latest_bmi.value}</b> : "—"}</Stat>
              <Stat icon={<Flame size={14} className="text-orange-500" />} label="Streak"><b>{p.streak}</b> days</Stat>
              <Stat icon={<PillIcon size={14} className="text-sky-500" />} label="Medicines (7d)">
                {p.med_adherence_7d === null ? "—" : (
                  <span className="flex items-center gap-2"><b>{p.med_adherence_7d}%</b>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-sky-500" style={{ width: `${p.med_adherence_7d}%` }} /></span>
                  </span>
                )}
              </Stat>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function Kpi({ icon, label, value, suffix = "", tone, delay }: { icon: ReactNode; label: string; value: number; suffix?: string; tone: string; delay: number }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card" style={{ animationDelay: `${delay}ms` }}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <p className="mt-3 text-2xl font-extrabold"><CountUp value={value} />{suffix}</p>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
    </div>
  );
}

function Stat({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50/80 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-muted">{icon}{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">{children}</dd>
    </div>
  );
}
