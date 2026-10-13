"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, setToken } from "@/lib/api";
import type { User } from "@/lib/types";
import PatientShell from "@/components/PatientShell";
import ClinicianShell from "@/components/ClinicianShell";

interface Auth { user: User; refresh: () => Promise<void>; signOut: () => void }
const AuthCtx = createContext<Auth | null>(null);
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthGate");
  return ctx;
};

/** Signs people in, and keeps each role inside its own area (patients: /, clinicians: /clinician). */
export default function AuthGate({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); return; }
    try { setUser(await api<User>("/auth/me")); } catch { setUser(null); }
  }, []);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  const signOut = () => { setToken(null); setUser(null); router.replace("/login"); };

  useEffect(() => {
    if (!ready) return;
    if (!user && path !== "/login") router.replace("/login");
    else if (user && path === "/login") router.replace(user.role === "clinician" ? "/clinician" : "/");
    else if (user?.role === "clinician" && !path.startsWith("/clinician")) router.replace("/clinician");
    else if (user?.role === "patient" && path.startsWith("/clinician")) router.replace("/");
  }, [ready, user, path, router]);

  if (!ready) return <p className="p-6">Loading…</p>;
  if (path === "/login") return <>{children}</>;
  if (!user) return null;
  const Shell = user.role === "clinician" ? ClinicianShell : PatientShell;
  return <AuthCtx.Provider value={{ user, refresh, signOut }}><Shell>{children}</Shell></AuthCtx.Provider>;
}
