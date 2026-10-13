"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { useToast } from "@/components/Toast";
import { Bell, Check, Clock, Pill, Plus } from "@/components/icons";
import { Btn, Card, Empty, ErrorNote, Field, PageTitle, Ring, Toggle } from "@/components/ui";
import { localDate, patch, post, to12h, useFetch } from "@/lib/api";
import { sfx } from "@/lib/sound";
import type { DoseRow } from "@/lib/types";

export default function MedicinesPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const day = localDate();
  const rows = useFetch<DoseRow[]>(`/medications/schedule?day=${day}`);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:00");

  const mark = async (r: DoseRow, status: "taken" | "skipped") => {
    try {
      await post("/medications/log", { medication_id: r.medication_id, day, slot: r.slot, status });
      if (status === "taken") sfx.pop();
      rows.reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); }
  };
  const add = async () => {
    try { await post("/medications", { name, dose: dose || null, times: time }); toast(`Added ${name}`); setName(""); setDose(""); rows.reload(); }
    catch (e) { toast(e instanceof Error ? e.message : "Check the details", "error"); }
  };
  const toggleReminders = async (on: boolean) => {
    if (on && typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
    await patch("/auth/me", { notifications_enabled: on });
    await refresh();
    toast(on ? "Reminders on" : "Reminders off");
  };

  const taken = rows.data?.filter((r) => r.status === "taken").length ?? 0;
  const total = rows.data?.length ?? 0;
  return (
    <>
      <PageTitle eyebrow="Medicines" sub="Tap each dose as you take it. Missed doses are reminded every 30 minutes.">Today&apos;s doses</PageTitle>
      <ErrorNote error={rows.error} />
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card delay={60} className="lg:col-span-2" title="Schedule" icon={<Clock size={16} className="text-sky-600" />}
          right={total > 0 && <span className="text-sm font-semibold text-ink-muted">{taken} of {total} taken</span>}>
          {rows.data && rows.data.length === 0 && <Empty icon={<Pill size={22} />}>No medicines yet. Add one to get started.</Empty>}
          <ol className="relative space-y-2">
            {rows.data?.map((r, i) => {
              const done = r.status === "taken", skipped = r.status === "skipped";
              return (
                <li key={`${r.medication_id}${r.slot}`} style={{ animationDelay: `${100 + i * 50}ms` }}
                  className={`flex animate-fade-up flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${
                    done ? "border-emerald-200 bg-emerald-50/60" : skipped ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${done ? "bg-emerald-500 text-white" : "bg-sky-50 text-sky-600"}`}>
                    {done ? <Check size={20} strokeWidth={3} /> : <Pill size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${skipped ? "text-ink-muted line-through" : ""}`}>{r.name} <span className="font-normal text-ink-muted">{r.dose}</span></span>
                    <span className="text-xs text-ink-muted">{to12h(r.slot)} · {done ? "Taken ✔" : skipped ? "Skipped" : "Not yet"}</span>
                  </span>
                  <span className="flex gap-1.5" role="group" aria-label={`Status of ${r.name} at ${to12h(r.slot)}`}>
                    <Btn size="sm" variant={done ? "primary" : "secondary"} aria-pressed={done} onClick={() => mark(r, "taken")}>
                      <Check size={15} /> Taken
                    </Btn>
                    <Btn size="sm" variant={skipped ? "dark" : "ghost"} aria-pressed={skipped} onClick={() => mark(r, "skipped")}>Skip</Btn>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="space-y-5">
          <Card delay={120} className="flex items-center gap-5">
            <Ring value={taken} goal={total || 1} size={96} stroke={10} color="#0ea5e9" label="Doses taken today">
              <span className="text-xl font-extrabold">{total ? Math.round((taken / total) * 100) : 0}%</span>
            </Ring>
            <div>
              <p className="font-bold">{taken === total && total > 0 ? "All done today 🎉" : "Keep it going"}</p>
              <p className="text-sm text-ink-muted">{total - taken} dose{total - taken === 1 ? "" : "s"} left today</p>
            </div>
          </Card>
          <Card delay={160} title="Reminders" icon={<Bell size={16} className="text-amber-500" />}>
            <Toggle checked={user.notifications_enabled} onChange={toggleReminders} label="Remind me to take my medicines"
              hint="Keep the app open in a tab or installed window to receive them." />
          </Card>
          <Card delay={200} title="Add a medicine" icon={<Plus size={16} className="text-brand-600" />}>
            <div className="space-y-3">
              <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Metformin" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dose"><input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="500 mg" /></Field>
                <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
              </div>
              <Btn className="w-full" disabled={!name.trim()} onClick={add}>Add medicine</Btn>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
