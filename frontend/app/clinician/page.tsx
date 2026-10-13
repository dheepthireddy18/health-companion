"use client";
import Link from "next/link";
import SummaryBox from "@/components/SummaryBox";
import { Card, Empty, ErrorNote, PageTitle, Pill } from "@/components/ui";
import { localDate, niceDate, useFetch } from "@/lib/api";
import type { PatientRow } from "@/lib/types";

export default function PatientList() {
  const { data, error } = useFetch<PatientRow[]>(`/clinician/patients?today=${localDate()}`);
  return (
    <>
      <PageTitle sub="Patients who need attention are listed first">All patients</PageTitle>
      <ErrorNote error={error} />
      {data?.length === 0 && <Empty>No patients yet.</Empty>}
      {data?.map((p) => (
        <Card key={p.id}>
          <SummaryBox patientId={p.id}>
            <Link href={`/clinician/patients/${p.id}`} className="text-2xl font-extrabold text-teal-800 underline">{p.name}</Link>
            <span className="ml-2 text-slate-700">{p.age ? `${p.age} yrs` : ""}</span>
          </SummaryBox>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Blood pressure">{p.latest_bp ? <><b>{p.latest_bp.value}</b> <Pill severity={p.latest_bp.severity}>{p.latest_bp.status}</Pill></> : "—"}</Stat>
            <Stat label="Blood sugar">{p.latest_glucose ? <><b>{p.latest_glucose.value}</b> <Pill severity={p.latest_glucose.severity}>{p.latest_glucose.status}</Pill></> : "—"}</Stat>
            <Stat label="Latest BMI">{p.latest_bmi ? <b>{p.latest_bmi.value}</b> : "—"}</Stat>
            <Stat label="Check-in streak">🔥 <b>{p.streak}</b> days</Stat>
            <Stat label="Medicines (7 days)">{p.med_adherence_7d === null ? "—" : <b>{p.med_adherence_7d}% taken</b>}</Stat>
          </dl>
          <p className="mt-2 text-sm text-slate-600">Last check-in: {p.last_check_in ? niceDate(p.last_check_in) : "never"}</p>
        </Card>
      ))}
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-sm text-slate-600">{label}</dt><dd className="font-medium">{children}</dd></div>;
}
