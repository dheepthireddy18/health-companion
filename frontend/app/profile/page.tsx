"use client";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import DoctorPicker from "@/components/DoctorPicker";
import { useToast } from "@/components/Toast";
import { Heart, Phone, Shield, User as UserIcon, Users } from "@/components/icons";
import { Avatar, Btn, Card, Chips, Field } from "@/components/ui";
import { patch } from "@/lib/api";
import type { User } from "@/lib/types";

type Form = Record<"name" | "phone" | "age" | "gender" | "height_cm" | "blood_type" | "allergies" | "emergency_contact_name" | "emergency_contact_phone" | "bio", string>;
const NUMERIC = new Set<keyof Form>(["age", "height_cm"]);
const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"].map((g) => ({ value: g, label: g }));
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const toForm = (u: User): Form => ({
  name: u.name, phone: u.phone ?? "", age: u.age?.toString() ?? "", gender: u.gender ?? "", height_cm: u.height_cm?.toString() ?? "",
  blood_type: u.blood_type ?? "", allergies: u.allergies ?? "", emergency_contact_name: u.emergency_contact_name ?? "",
  emergency_contact_phone: u.emergency_contact_phone ?? "", bio: u.bio ?? "",
});

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const patient = user.role === "patient";
  const initial = useMemo(() => toForm(user), [user]);
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const bind = (k: keyof Form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => set(k)(e.target.value) });

  const fields: (keyof Form)[] = patient
    ? ["name", "phone", "age", "gender", "height_cm", "blood_type", "allergies", "emergency_contact_name", "emergency_contact_phone"]
    : ["name", "phone", "bio"];
  const complete = Math.round((fields.filter((k) => form[k].trim()).length / fields.length) * 100);
  const changed = (Object.keys(form) as (keyof Form)[]).filter((k) => form[k].trim() !== initial[k].trim());

  const chooseDoctor = async (id: number) => {
    try {
      const u = await patch<User>("/auth/me", { clinician_id: id });
      await refresh();
      toast(id === 0 ? "Matched with an available doctor" : "Doctor updated");
      return u;
    } catch (e) { toast(e instanceof Error ? e.message : "Could not change doctor", "error"); }
  };

  const save = async () => {
    const body: Record<string, string | number> = {};
    for (const k of changed) {
      const v = form[k].trim();
      if (NUMERIC.has(k)) { if (v) body[k] = Number(v); } else body[k] = v;
    }
    setBusy(true);
    try { await patch("/auth/me", body); await refresh(); toast("Profile saved"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <section className="relative animate-fade-up overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
        <div className="h-28 bg-gradient-to-r from-brand-500 via-teal-500 to-sky-500" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-6">
          <Avatar name={form.name || user.name} size={92} className="-mt-12 ring-4 ring-white shadow-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{form.name || user.name}</h1>
            <p className="text-sm text-ink-muted">{user.email} · <span className="capitalize">{user.role}</span></p>
          </div>
          <div className="w-full sm:w-56">
            <div className="mb-1 flex justify-between text-xs font-semibold"><span className="text-ink-muted">Profile complete</span><span>{complete}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-sky-500 transition-[width] duration-700" style={{ width: `${complete}%` }} />
            </div>
          </div>
        </div>
      </section>

      <form className="grid items-start gap-5 lg:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Card delay={80} title="Personal details" icon={<UserIcon size={16} className="text-brand-600" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Full name"><input required {...bind("name")} autoComplete="name" /></Field></div>
            <Field label="Phone"><input type="tel" {...bind("phone")} autoComplete="tel" placeholder="+91 98765 43210" /></Field>
            {patient && <Field label="Age"><input type="number" inputMode="numeric" min={1} max={120} {...bind("age")} /></Field>}
            {patient && (
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-soft">Gender</p>
                <Chips label="Gender" options={GENDERS} value={form.gender} onChange={set("gender")} />
              </div>
            )}
            {!patient && (
              <div className="sm:col-span-2">
                <Field label="Specialty & bio" hint="Shown to your patients in the future.">
                  <textarea rows={4} maxLength={500} {...bind("bio")} placeholder="Endocrinologist · 10 years in diabetes care" />
                </Field>
              </div>
            )}
          </div>
        </Card>

        {patient && (
          <div className="space-y-5">
            <Card delay={140} title="Health basics" icon={<Heart size={16} className="text-rose-500" />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Height (cm)" hint="Pre-fills the BMI calculator.">
                  <input type="number" inputMode="decimal" min={50} max={250} {...bind("height_cm")} />
                </Field>
                <Field label="Blood type">
                  <select {...bind("blood_type")}>{BLOOD.map((b) => <option key={b} value={b}>{b || "Not sure"}</option>)}</select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Allergies"><textarea rows={2} maxLength={300} {...bind("allergies")} placeholder="e.g. penicillin, peanuts" /></Field>
                </div>
              </div>
            </Card>
            <Card delay={170} title="My doctor" icon={<Users size={16} className="text-violet-600" />}
              right={<span className="text-xs text-ink-muted">Saves when you choose</span>}>
              <DoctorPicker value={user.clinician_id ?? 0} onChange={chooseDoctor} compact />
            </Card>
            <Card delay={200} title="Emergency contact" icon={<Shield size={16} className="text-amber-500" />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name"><input {...bind("emergency_contact_name")} placeholder="Family member or friend" /></Field>
                <Field label="Phone"><input type="tel" {...bind("emergency_contact_phone")} /></Field>
              </div>
              {form.emergency_contact_phone.trim() && (
                <a href={`tel:${form.emergency_contact_phone.trim()}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                  <Phone size={14} /> Call {form.emergency_contact_name.trim() || "contact"}
                </a>
              )}
            </Card>
          </div>
        )}

        <div className="sticky bottom-4 z-30 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lift backdrop-blur lg:col-span-2">
          <span className="mr-auto pl-2 text-sm text-ink-muted">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "All changes saved"}</span>
          <Btn type="button" variant="ghost" disabled={!changed.length} onClick={() => setForm(initial)}>Discard</Btn>
          <Btn type="submit" disabled={!changed.length || busy || !form.name.trim()}>{busy ? "Saving…" : "Save profile"}</Btn>
        </div>
      </form>
    </>
  );
}
