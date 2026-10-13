"use client";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthGate";
import { api, localDateTime, post } from "@/lib/api";
import type { Notice } from "@/lib/types";

async function show(n: Notice) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options = { body: n.body, tag: n.tag, data: { url: n.url }, requireInteraction: true };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(n.title, options);
  else new Notification(n.title, options);
}

/**
 * Registers the service worker, announces the login nudge once per session, then asks the server every minute
 * which reminders are due. The server decides (30-minute repeats, off switch), so this only displays them.
 * Reminders arrive while the app is open in a tab or installed window.
 */
export default function Notifier() {
  const { user } = useAuth();
  const welcomed = useRef(false);

  useEffect(() => {
    if (!user.notifications_enabled || typeof window === "undefined") return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});

    const tick = async () => {
      try {
        if (!welcomed.current) {
          welcomed.current = true;
          if (!sessionStorage.getItem("hc_welcomed")) {
            sessionStorage.setItem("hc_welcomed", "1");
            const hello = await post<Notice | null>(`/notifications/welcome?now=${localDateTime()}`);
            if (hello) await show(hello);
          }
        }
        for (const n of await api<Notice[]>(`/notifications/due?now=${localDateTime()}`)) await show(n);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [user.notifications_enabled]);

  return null;
}
