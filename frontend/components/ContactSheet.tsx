"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { Btn, ErrorNote } from "@/components/ui";
import { api, niceDate, niceTime, post, useFetch } from "@/lib/api";
import { emergencyNumber } from "@/lib/emergency";
import type { ChatMessage, Home } from "@/lib/types";

const LINK = "flex min-h-[4rem] items-center justify-center rounded-xl px-5 py-3 text-lg font-bold text-center";

/** Options in priority order: 1. local emergency number, 2. chat, 3. call the clinician. */
export default function ContactSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { data: home } = useFetch<Home>("/home");
  const [chat, setChat] = useState(false);
  const number = emergencyNumber(user.emergency_number, typeof navigator !== "undefined" ? navigator.language : "en-US");
  const phone = home?.clinician?.phone;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog"
         aria-modal="true" aria-label="Contact">
      <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5">
        <h2 className="text-2xl font-extrabold">Who do you need?</h2>
        <a href={`tel:${number}`} className={`${LINK} bg-red-700 text-white hover:bg-red-800`}>
          🚨 Call local emergency: {number}
        </a>
        {chat ? <Chat /> : (
          <Btn className="w-full !min-h-[4rem] text-lg" onClick={() => setChat(true)}>
            💬 Chat with {home?.clinician?.name ?? "my clinician"}
          </Btn>
        )}
        {phone ? (
          <a href={`tel:${phone}`} className={`${LINK} bg-teal-700 text-white hover:bg-teal-800`}>📞 Call {home?.clinician?.name}</a>
        ) : <p className="rounded-xl bg-slate-100 p-3">Your clinician has not shared a phone number yet.</p>}
        <Btn variant="secondary" className="w-full" onClick={onClose}>Close</Btn>
      </div>
    </div>
  );
}

function Chat() {
  const { data, reload, error } = useFetch<ChatMessage[]>("/messages");
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    try { await post("/messages", { body: text }); setText(""); setErr(null); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not send"); }
  };
  useEffect(() => { const id = setInterval(reload, 15000); return () => clearInterval(id); }, [reload]);

  return (
    <div className="space-y-2 rounded-xl border-2 border-slate-200 p-3">
      <div className="max-h-56 space-y-2 overflow-y-auto" aria-live="polite">
        {(data ?? []).map((m) => (
          <p key={m.id} className={`rounded-xl p-2 ${m.from_role === "patient" ? "ml-8 bg-teal-100" : "mr-8 bg-slate-100"}`}>
            <span className="block text-xs text-slate-600">{m.sender} · {niceDate(m.created_at)} {niceTime(m.created_at)}</span>{m.body}
          </p>
        ))}
      </div>
      <ErrorNote error={error || err} />
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message" aria-label="Message" />
      <Btn className="w-full" onClick={send}>Send message</Btn>
    </div>
  );
}
