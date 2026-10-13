"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthGate";
import ChatThread from "@/components/ChatThread";
import { Chat, ChevronLeft, Close, Minimize, Search } from "@/components/icons";
import { Avatar, Skeleton } from "@/components/ui";
import { ago, post, useFetch } from "@/lib/api";
import type { ChatMessage, Thread } from "@/lib/types";

const DockCtx = createContext<(patientId: number) => void>(() => {});
/** Open the dock on one patient's conversation, e.g. from a records page. */
export const useOpenChat = () => useContext(DockCtx);

/**
 * Clinicians look after many patients, so chat lives in its own dock: a chat button in the bottom-right corner
 * opens a panel listing every conversation (unanswered first by recency), and a patient opens their thread.
 */
export default function ClinicianChatDock({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const threads = useFetch<Thread[]>("/clinician/threads");
  const waiting = (threads.data ?? []).filter((t) => t.last_from_role === "patient").length;

  useEffect(() => { const id = setInterval(threads.reload, 20000); return () => clearInterval(id); }, [threads.reload]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openWith = useCallback((id: number) => { setActive(id); setOpen(true); }, []);
  const current = threads.data?.find((t) => t.patient_id === active);

  return (
    <DockCtx.Provider value={openWith}>
      {children}
      {open && (
        <div role="dialog" aria-label="Patient messages"
          className="fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-[400px] animate-slide-in flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lift sm:right-7">
          {active !== null ? (
            <ThreadView key={active} id={active} name={current?.name ?? "Patient"} onBack={() => { setActive(null); threads.reload(); }}
              onClose={() => setOpen(false)} onSent={threads.reload} />
          ) : (
            <ThreadList threads={threads.data} onPick={setActive} onClose={() => setOpen(false)} waiting={waiting} />
          )}
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Collapse messages" : `Open messages${waiting ? `, ${waiting} awaiting reply` : ""}`}
        className={`group fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-lift transition duration-200 hover:scale-110 hover:bg-slate-800 sm:bottom-7 sm:right-7 ${open ? "scale-105" : ""}`}>
        <span className={`transition duration-300 ${open ? "rotate-90" : ""}`}>{open ? <Close size={24} /> : <Chat size={24} />}</span>
        {!open && waiting > 0 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-[1.5rem] animate-pop-in place-items-center rounded-full bg-rose-500 px-1.5 text-xs font-bold ring-2 ring-white">
            {waiting}
          </span>
        )}
      </button>
    </DockCtx.Provider>
  );
}

function ThreadList({ threads, onPick, onClose, waiting }: {
  threads: Thread[] | null; onPick: (id: number) => void; onClose: () => void; waiting: number;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "waiting">("all");
  const rows = useMemo(() => (threads ?? []).filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()) &&
    (filter === "all" || (filter === "mine" ? t.clinician_id === user.id : t.last_from_role === "patient"))), [threads, q, filter, user.id]);

  return (
    <>
      <header className="border-b border-slate-200 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold">Messages</p>
            <p className="text-xs text-ink-muted">{waiting ? `${waiting} awaiting your reply` : "You're all caught up"}</p>
          </div>
          <button onClick={onClose} aria-label="Collapse messages" className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-slate-100"><Minimize size={18} /></button>
        </div>
        <div className="relative mt-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients" aria-label="Search patients" className="!py-2 !pl-9" />
        </div>
        <div className="mt-2 flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(["all", "mine", "waiting"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`flex-1 rounded-lg py-1.5 transition ${filter === f ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {f === "all" ? "All" : f === "mine" ? "Mine" : `Awaiting${waiting ? ` · ${waiting}` : ""}`}
            </button>
          ))}
        </div>
      </header>
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {threads === null && [0, 1, 2, 3].map((i) => <li key={i} className="p-2"><Skeleton className="h-12" /></li>)}
        {threads && rows.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">No conversations match.</li>}
        {rows.map((t, i) => {
          const unanswered = t.last_from_role === "patient";
          return (
            <li key={t.patient_id} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
              <button onClick={() => onPick(t.patient_id)}
                className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-slate-50">
                <Avatar name={t.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${unanswered ? "font-bold" : "font-semibold"}`}>
                      {t.name}{t.clinician_id === user.id && <span className="ml-1.5 rounded bg-brand-50 px-1 py-px text-[0.6rem] font-bold uppercase text-brand-700">Mine</span>}
                    </span>
                    {t.last_at && <span className="shrink-0 text-[0.7rem] text-slate-400">{ago(t.last_at)}</span>}
                  </span>
                  <span className={`block truncate text-xs ${unanswered ? "font-medium text-ink" : "text-ink-muted"}`}>
                    {t.last_body ? `${t.last_from_role === "clinician" ? "You: " : ""}${t.last_body}` : "No messages yet"}
                  </span>
                </span>
                {unanswered && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" aria-label="Awaiting reply" />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ThreadView({ id, name, onBack, onClose, onSent }: {
  id: number; name: string; onBack: () => void; onClose: () => void; onSent: () => void;
}) {
  const chat = useFetch<ChatMessage[]>(`/clinician/patients/${id}/messages`);
  useEffect(() => { const t = setInterval(chat.reload, 10000); return () => clearInterval(t); }, [chat.reload]);
  return (
    <>
      <header className="flex items-center gap-2 border-b border-slate-200 px-2 py-2.5">
        <button onClick={onBack} aria-label="Back to all conversations" className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-slate-100"><ChevronLeft size={20} /></button>
        <Avatar name={name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <Link href={`/clinician/patients/${id}`} onClick={onClose} className="text-xs font-semibold text-brand-700 hover:underline">View records →</Link>
        </div>
        <button onClick={onClose} aria-label="Collapse messages" className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-slate-100"><Minimize size={18} /></button>
      </header>
      <ChatThread messages={chat.data} me="clinician" error={chat.error} placeholder={`Reply to ${name.split(" ")[0]}…`}
        emptyText="No messages yet. Start the conversation."
        onSend={async (body) => { await post(`/clinician/patients/${id}/messages`, { body }); await chat.reload(); onSent(); }} />
    </>
  );
}
