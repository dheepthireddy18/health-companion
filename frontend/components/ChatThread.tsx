"use client";
import { useEffect, useRef, useState } from "react";
import { Chat, Send } from "@/components/icons";
import { ErrorNote, Skeleton } from "@/components/ui";
import { niceDate, niceTime } from "@/lib/api";
import { sfx } from "@/lib/sound";
import type { ChatMessage } from "@/lib/types";

/** Message bubbles plus a composer. `me` decides which side is "mine". Enter sends, Shift+Enter adds a line. */
export default function ChatThread({ messages, me, onSend, error, placeholder = "Write a message…", emptyText }: {
  messages: ChatMessage[] | null; me: ChatMessage["from_role"]; onSend: (body: string) => Promise<void>;
  error?: string | null; placeholder?: string; emptyText: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await onSend(body); setText(""); setErr(null); sfx.send(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not send"); }
    finally { setBusy(false); }
  };

  let lastDay = "";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-slate-50/70 px-4 py-4" aria-live="polite">
        {messages === null && <div className="space-y-2"><Skeleton className="h-10 w-2/3" /><Skeleton className="ml-auto h-10 w-1/2" /></div>}
        {messages?.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm text-ink-muted">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600"><Chat size={22} /></span>
            {emptyText}
          </div>
        )}
        {messages?.map((m) => {
          const mine = m.from_role === me;
          const day = niceDate(m.created_at);
          const divider = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {divider && <p className="py-2 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">{day}</p>}
              <div className={`flex animate-slide-in ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                  mine ? "rounded-br-md bg-gradient-to-br from-brand-500 to-brand-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-ink"}`}>
                  {!mine && <span className="mb-0.5 block text-[0.7rem] font-bold text-brand-700">{m.sender}</span>}
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                  <span className={`mt-0.5 block text-right text-[0.65rem] ${mine ? "text-white/70" : "text-slate-400"}`}>{niceTime(m.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3">
        <ErrorNote error={error || err} />
        <div className="flex items-end gap-2">
          <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-32 min-h-[2.75rem] resize-none !rounded-2xl" />
          <button onClick={send} disabled={!text.trim() || busy} aria-label="Send message"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700 active:scale-90 disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
