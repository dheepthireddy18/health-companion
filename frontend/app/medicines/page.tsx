"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { Btn, Card, Empty, ErrorNote, Field, PageTitle } from "@/components/ui";
import { localDate, patch, post, to12h, useFetch } from "@/lib/api";
import type { DoseRow } from "@/lib/types";

export default function MedicinesPage() {
  const { user, refresh } = useAuth();
  const day = localDate();
  const rows = useFetch<DoseRow[]>(`/medications/schedule?day=${day}`);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:00");
  const [error, setError] = useState<string | null>(null);

  const mark = async (r: DoseRow, status: string) => {
    if (status === "pending") return;
    try { await post("/medications/log", { medication_id: r.medication_id, day, slot: r.slot, status }); rows.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save"); }
  };
  const add = async () => {
    try { await post("/medications", { name, dose: dose || null, times: time }); setName(""); setDose(""); setError(null); rows.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Check the details"); }
  };
  const toggleReminders = async (on: boolean) => {
    if (on && typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
    await patch("/auth/me", { notifications_enabled: on });
    await refresh();
  };

  return (
    <>
      <PageTitle sub="Mark each dose. Missed doses are reminded every 30 minutes.">Medicines</PageTitle>
      <ErrorNote error={error || rows.error} />
      <Card title="Today's doses">
        {rows.data && rows.data.length > 0 ? (
          <ul className="divide-y">{rows.data.map((r) => (
            <li key={`${r.medication_id}${r.slot}`} className="grid items-center gap-2 py-3 sm:grid-cols-2">
              <span className="text-lg"><b>{to12h(r.slot)}</b> · {r.name} {r.dose}</span>
              <select aria-label={`Status of ${r.name} at ${to12h(r.slot)}`} value={r.status} onChange={(e) => mark(r, e.target.value)}>
                {r.status === "pending" && <option value="pending">Not yet</option>}
                <option value="taken">✔ Taken</option><option value="skipped">Skipped</option>
              </select>
            </li>))}</ul>
        ) : <Empty>No medicines yet. Add one below.</Empty>}
      </Card>
      <Card title="Reminders">
        <label className="flex items-center gap-3 text-lg font-semibold">
          <input type="checkbox" checked={user.notifications_enabled} onChange={(e) => toggleReminders(e.target.checked)} />
          Remind me to take my medicines
        </label>
        <p className="mt-2 text-slate-700">Untick to stop all reminders. Keep this app open in a tab or installed window to receive them.</p>
      </Card>
      <Card title="Add a medicine">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Dose"><input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="500 mg" /></Field>
          <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <Btn className="mt-4 w-full" disabled={!name.trim()} onClick={add}>Add medicine</Btn>
      </Card>
    </>
  );
}
