"use client";
import type { ReactNode } from "react";
import Backdrop from "@/components/Backdrop";
import ClinicianChatDock from "@/components/ClinicianChatDock";
import { ToastProvider } from "@/components/Toast";
import TopBar from "@/components/TopBar";
import { Users } from "@/components/icons";

const items = [{ href: "/clinician", label: "Patients", icon: <Users size={16} /> }];

export default function ClinicianShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ClinicianChatDock>
        <Backdrop />
        <TopBar items={items} home="/clinician" tag="Clinician" />
        <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-8">{children}</main>
      </ClinicianChatDock>
    </ToastProvider>
  );
}
