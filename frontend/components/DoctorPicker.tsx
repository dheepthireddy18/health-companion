"use client";
import { Sparkles } from "@/components/icons";
import { Avatar, Skeleton } from "@/components/ui";
import { useFetch } from "@/lib/api";
import type { ClinicianPublic } from "@/lib/types";

/** Pick a doctor, or 0 for "any available doctor". Away doctors can still be chosen; on-call colleagues cover. */
export default function DoctorPicker({ value, onChange, compact = false }: {
  value: number; onChange: (id: number) => void; compact?: boolean;
}) {
  const { data, error } = useFetch<ClinicianPublic[]>("/auth/clinicians");
  const chosen = data?.find((d) => d.id === value);
  const onCall = data?.filter((d) => d.on_call && d.id !== value) ?? [];
  const card = (on: boolean) => `flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
    on ? "border-brand-500 bg-brand-50/70 ring-4 ring-brand-500/10" : "border-slate-200 bg-white hover:border-slate-300"}`;

  if (error) return <p className="text-sm text-rose-700">Couldn&apos;t load the list of doctors.</p>;
  if (!data) return <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  return (
    <div>
      <div role="radiogroup" aria-label="Your doctor" className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <button type="button" role="radio" aria-checked={value === 0} onClick={() => onChange(0)} className={card(value === 0)}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-sky-500 text-white"><Sparkles size={18} /></span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Any available doctor</span>
            <span className="block text-xs text-ink-muted">We&apos;ll match you with whoever has room</span>
          </span>
        </button>
        {data.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={value === d.id} onClick={() => onChange(d.id)} className={card(value === d.id)}>
            <Avatar name={d.name.replace(/^Dr\.?\s*/, "")} size={40} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                {d.name}
                {d.on_call && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-violet-700">On call</span>}
              </span>
              {d.bio && <span className="block truncate text-xs text-ink-muted">{d.bio.split("·")[0].trim()}</span>}
              <span className={`mt-0.5 flex items-center gap-1 text-[0.7rem] font-semibold ${d.available ? "text-brand-700" : "text-amber-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${d.available ? "bg-brand-500" : "bg-amber-500"}`} />
                {d.available ? "Available" : "Away"}
              </span>
            </span>
          </button>
        ))}
      </div>
      {chosen && !chosen.available && (
        <p className="mt-2 animate-slide-in rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/20">
          {chosen.name} is away right now. You can still choose them;
          {onCall.length ? ` until they're back, ${onCall.map((d) => d.name).join(" or ")} (on call) can help.` : " the care team will reply in the meantime."}
        </p>
      )}
    </div>
  );
}
