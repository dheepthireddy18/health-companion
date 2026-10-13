"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import ChatThread from "@/components/ChatThread";
import { Chat, Close, Phone } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/ui";
import { post, useFetch } from "@/lib/api";
import { sfx } from "@/lib/sound";
import type { ChatMessage, Home } from "@/lib/types";

/**
 * Round "contact my clinician" button in the bottom-right corner. Hovering (or tapping, on touch screens)
 * fans out two options: text, which opens a chat panel, and call. Messages are checked in the background so a
 * message from anyone on the care team shows as a badge (with a sound) even while the panel is closed.
 */
interface Contact { id: number; name: string; tag: string }

export default function ContactFab() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: home } = useFetch<Home>("/home");
  const messages = useFetch<ChatMessage[]>("/messages");
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const clinician = home?.clinician;
  const away = !!home && (!clinician || !clinician.available);
  const cover = away ? (home?.on_call ?? []) : [];
  const first = clinician?.name ?? "my clinician";

  // Conversations are private, one per doctor: the patient's own doctor, on-call cover while they're away,
  // and any doctor who has written to them.
  const all = messages.data ?? [];
  const contacts: Contact[] = [];
  const addContact = (c: Contact) => { if (!contacts.some((x) => x.id === c.id)) contacts.push(c); };
  if (clinician) addContact({ id: clinician.id, name: clinician.name, tag: clinician.available ? "Your doctor" : "Your doctor · away" });
  cover.forEach((c) => addContact({ id: c.id, name: c.name, tag: "On call" }));
  all.forEach((m) => { if (m.from_role === "clinician" && m.clinician_id) addContact({ id: m.clinician_id, name: m.sender, tag: "" }); });

  // Read state per conversation: the newest message id seen from each doctor, per account on this device.
  const seenKey = `hc_seen_conv_${user.id}`;
  const [seen, setSeen] = useState<Record<number, number>>({});
  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem(seenKey) || "{}")); } catch {} }, [seenKey]);
  const incoming = all.filter((m) => m.from_role === "clinician");
  const newest = incoming.length ? incoming[incoming.length - 1] : null;
  const unreadFor = (cid: number) => incoming.filter((m) => m.clinician_id === cid && m.id > (seen[cid] ?? 0)).length;
  const unread = contacts.reduce((n, c) => n + unreadFor(c.id), 0);
  const [active, setActive] = useState<number | null>(null);
  const defaultConv = contacts.find((c) => unreadFor(c.id) > 0)?.id ?? (away ? cover[0]?.id : undefined) ?? contacts[0]?.id ?? null;
  const current = active ?? defaultConv;
  const openChat = (cid: number | null = null) => { setActive(cid ?? defaultConv); setChat(true); setOpen(false); };

  useEffect(() => { const id = setInterval(messages.reload, chat ? 8000 : 20000); return () => clearInterval(id); }, [messages.reload, chat]);

  // Viewing a conversation marks it read.
  useEffect(() => {
    if (!chat || current === null) return;
    const last = incoming.filter((m) => m.clinician_id === current).pop();
    if (!last || last.id <= (seen[current] ?? 0)) return;
    const next = { ...seen, [current]: last.id };
    setSeen(next);
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch {}
  }, [chat, current, incoming, seen, seenKey]);

  // Announce messages that arrive while the app is open (the backlog on first load only gets the badge).
  const lastNewest = useRef<number | null>(null);
  useEffect(() => {
    if (messages.data === null) return;
    const id = newest?.id ?? 0;
    if (lastNewest.current !== null && id > lastNewest.current && newest && !(chat && current === newest.clinician_id)) {
      sfx.chime();
      toast(`New message from ${newest.sender}`);
    }
    lastNewest.current = id;
  }, [messages.data, newest, chat, current, toast]);

  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const hide = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setChat(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const option = "flex items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink shadow-lift ring-1 ring-slate-200 transition hover:-translate-x-1 hover:ring-brand-400";
  return (
    <>
      {chat && (
        <ChatPanel contacts={contacts} current={current} onPick={setActive} unreadFor={unreadFor}
          messages={messages.data && messages.data.filter((m) => m.clinician_id === current)} error={messages.error}
          onClose={() => setChat(false)}
          onSend={async (body) => { await post("/messages", { body, clinician_id: current }); await messages.reload(); }} />
      )}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7"
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(); }}>
        {open && !chat && (
          <div className="flex flex-col items-end gap-2.5" role="menu" aria-label={`Contact ${first}`}>
            {away && (
              <p className="animate-pop-in rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm ring-1 ring-amber-600/20">
                {clinician ? `${first} is away` : "No doctor assigned"}{cover.length ? " · on-call cover below" : ""}
              </p>
            )}
            <button role="menuitem" className={`${option} animate-pop-in`} style={{ animationDelay: "60ms" }}
              onClick={() => openChat()}>
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700">
                <Chat size={18} />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
              </span>
              {unread > 0 ? `${unread} new message${unread === 1 ? "" : "s"}` : away ? (cover.length ? "Message the on-call doctor" : `Message ${first}`) : `Text ${first}`}
            </button>
            {away ? (
              cover.length ? cover.map((c) => (
                <a key={c.id} role="menuitem" href={c.phone ? `tel:${c.phone}` : undefined} className={`${option} animate-pop-in`}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-violet-50 text-violet-700"><Phone size={18} /></span>
                  <span className="text-left leading-tight">Call on-call doctor<span className="block text-xs font-normal text-ink-muted">{c.name}</span></span>
                </a>
              )) : (
                <span role="menuitem" aria-disabled className={`${option} animate-pop-in cursor-not-allowed opacity-70 hover:translate-x-0 hover:ring-slate-200`}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400"><Phone size={18} /></span>
                  No on-call doctor right now — send a message
                </span>
              )
            ) : clinician?.phone ? (
              <a role="menuitem" href={`tel:${clinician.phone}`} className={`${option} animate-pop-in`}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-50 text-sky-700"><Phone size={18} /></span>
                Call {first}
              </a>
            ) : (
              <span role="menuitem" aria-disabled className={`${option} animate-pop-in cursor-not-allowed opacity-70 hover:translate-x-0 hover:ring-slate-200`}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400"><Phone size={18} /></span>
                No phone number shared yet
              </span>
            )}
          </div>
        )}
        <button aria-label={chat ? "Close chat" : `Contact ${first}${unread ? `, ${unread} unread` : ""}`} aria-expanded={open || chat} aria-haspopup="menu"
          onClick={() => (chat ? setChat(false) : setOpen((o) => !o))}
          className={`group relative grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lift transition duration-200
            hover:scale-110 hover:shadow-glow ${open || chat ? "scale-105 shadow-glow" : ""}`}>
          {!open && !chat && <span aria-hidden className={`absolute inset-0 animate-ping-soft rounded-full ${unread ? "bg-rose-400" : "bg-brand-400"}`} />}
          <span className={`relative transition duration-300 ${open || chat ? "rotate-90" : ""}`}>
            {open || chat ? <Close size={24} /> : <Chat size={24} />}
          </span>
          {!open && !chat && unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-6 min-w-[1.5rem] animate-pop-in place-items-center rounded-full bg-rose-500 px-1.5 text-xs font-bold ring-2 ring-white">
              {unread}
            </span>
          )}
        </button>
      </div>
    </>
  );
}

function ChatPanel({ contacts, current, onPick, unreadFor, messages, error, onSend, onClose }: {
  contacts: Contact[]; current: number | null; onPick: (id: number) => void; unreadFor: (id: number) => number;
  messages: ChatMessage[] | null; error: string | null; onSend: (body: string) => Promise<void>; onClose: () => void;
}) {
  const who = contacts.find((c) => c.id === current);
  return (
    <div role="dialog" aria-label={who ? `Chat with ${who.name}` : "Chat"}
      className="fixed bottom-24 right-4 z-50 flex h-[min(580px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-sm animate-slide-in flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lift sm:right-7">
      <header className="bg-gradient-to-r from-brand-600 to-teal-600 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <Avatar name={(who?.name ?? "Care team").replace(/^Dr\.?\s*/, "")} size={38} className="ring-2 ring-white/40" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{who?.name ?? "No doctor yet"}</p>
            <p className="truncate text-xs text-white/80">{who?.tag ? `${who.tag} · ` : ""}Private conversation</p>
          </div>
          <button onClick={onClose} aria-label="Close chat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"><Close size={18} /></button>
        </div>
        {contacts.length > 1 && (
          <div role="tablist" aria-label="Conversations" className="scrollbar-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {contacts.map((c) => {
              const on = c.id === current, n = unreadFor(c.id);
              return (
                <button key={c.id} role="tab" aria-selected={on} onClick={() => onPick(c.id)}
                  className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    on ? "bg-white text-brand-800" : "bg-white/15 text-white hover:bg-white/25"}`}>
                  {c.name.replace(/^Dr\.?\s*/, "Dr. ").split(" ").slice(0, 2).join(" ")}
                  {c.tag === "On call" && <span className={`rounded px-1 text-[0.6rem] ${on ? "bg-violet-100 text-violet-700" : "bg-white/20"}`}>on call</span>}
                  {n > 0 && <span className="grid h-4 min-w-[1rem] place-items-center rounded-full bg-rose-500 px-1 text-[0.6rem] text-white">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
      </header>
      {current === null ? (
        <p className="p-6 text-center text-sm text-ink-muted">Choose a doctor in your profile to start a conversation.</p>
      ) : (
        <ChatThread key={current} messages={messages} me="patient" error={error} onSend={onSend}
          emptyText={`Say hello to ${who?.name ?? "your doctor"}. Only you and them can see this conversation. Not monitored for emergencies.`} />
      )}
    </div>
  );
}
