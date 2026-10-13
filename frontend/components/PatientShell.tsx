"use client";
import type { ReactNode } from "react";
import Backdrop from "@/components/Backdrop";
import ContactFab from "@/components/ContactFab";
import Notifier from "@/components/Notifier";
import { ToastProvider } from "@/components/Toast";
import TopBar from "@/components/TopBar";
import { Activity, CheckCircle, Home, Pill } from "@/components/icons";

const items = [
  { href: "/", label: "Today", icon: <Home size={16} />, exact: true },
  { href: "/track", label: "Track", icon: <Activity size={16} /> },
  { href: "/medicines", label: "Medicines", icon: <Pill size={16} /> },
  { href: "/habits", label: "Habits", icon: <CheckCircle size={16} /> },
];

/** Header, page body, and the floating contact button every patient page carries. */
export default function PatientShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Notifier />
      <Backdrop />
      <TopBar items={items} home="/" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-24 text-xs text-ink-muted sm:px-6">
        This app records your information. It does not give medical advice; follow your clinician&apos;s instructions.
      </footer>
      <ContactFab />
    </ToastProvider>
  );
}
