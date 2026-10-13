"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (el: HTMLElement, o: Record<string, string | number>) => void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

const SCRIPT = "https://accounts.google.com/gsi/client";
let loading: Promise<void> | null = null;
const loadScript = () => (loading ??= new Promise<void>((resolve, reject) => {
  const s = document.createElement("script");
  s.src = SCRIPT; s.async = true; s.onload = () => resolve(); s.onerror = () => { loading = null; reject(); };
  document.head.appendChild(s);
}));

const GLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/**
 * Google's own "Continue with Google" button (Google Identity Services). The ID token it returns goes to
 * onCredential; the backend verifies it. If the server has no GOOGLE_CLIENT_ID, a disabled look-alike explains why.
 */
export default function GoogleSignIn({ onCredential }: { onCredential: (credential: string) => void }) {
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    api<{ client_id: string | null }>("/auth/google-config").then((c) => setClientId(c.client_id)).catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !box.current) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), ux_mode: "popup" });
      window.google.accounts.id.renderButton(box.current, {
        theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center",
        width: Math.min(400, box.current.offsetWidth || 320),
      });
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [clientId]);

  if (clientId === undefined) return <div className="h-11 animate-pulse rounded-full bg-slate-100" />;
  if (!clientId || failed) {
    return (
      <div>
        <button type="button" disabled
          className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-white text-sm font-semibold text-ink-muted opacity-70">
          <GLogo /> Continue with Google
        </button>
        <p className="mt-1.5 text-center text-xs text-ink-muted">
          {failed ? "Couldn't reach Google. Check your connection." : "Google sign-in isn't set up on this server yet."}
        </p>
      </div>
    );
  }
  return <div ref={box} className="flex min-h-[44px] justify-center" />;
}
