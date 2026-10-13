"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthGate";
import { Btn } from "@/components/ui";

export default function ClinicianShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <nav aria-label="Main" className="border-b-2 border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/clinician" className="text-xl font-extrabold text-teal-800">Health Companion · Clinician</Link>
          <div className="flex items-center gap-3"><span className="font-semibold">{user.name}</span>
            <Btn variant="secondary" onClick={signOut}>Sign out</Btn></div>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">{children}</main>
    </>
  );
}
