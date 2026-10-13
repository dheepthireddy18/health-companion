"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthGate";
import ContactSheet from "@/components/ContactSheet";
import Notifier from "@/components/Notifier";
import { Btn } from "@/components/ui";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/food", label: "Food", icon: "🥗" },
  { href: "/activity", label: "Activity", icon: "🚶" },
  { href: "/health", label: "Health", icon: "🩺" },
  { href: "/medicines", label: "Medicines", icon: "💊" },
  { href: "/habits", label: "Habits", icon: "✅" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

/** Navigation links plus the one "Contact clinician" button every patient page carries. */
export default function PatientShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const { user } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <>
      <Notifier />
      <nav aria-label="Main" className="border-b-2 border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 text-xl font-extrabold text-teal-800">Health Companion</span>
          {items.map((i) => {
            const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                className={`min-h-[3rem] rounded-xl border-2 px-3 py-2 font-semibold ${
                  active ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white hover:bg-slate-100"}`}>
                <span aria-hidden>{i.icon} </span>{i.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {children}
        <Btn variant="danger" className="w-full" onClick={() => setContactOpen(true)}>Contact clinician or get help</Btn>
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-slate-600">
        Hello, {user.name}. This app records your information. It does not give medical advice; follow your clinician&apos;s instructions.
      </footer>
      {contactOpen && <ContactSheet onClose={() => setContactOpen(false)} />}
    </>
  );
}
