"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, setToken } from "@/lib/api";
import { applyMotion } from "@/lib/prefs";
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

/** Pages both roles use (their own profile and settings). */
const SHARED = ["/profile", "/settings"];

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

  useEffect(() => { applyMotion(); refresh().finally(() => setReady(true)); }, [refresh]);

  const signOut = () => { setToken(null); setUser(null); router.replace("/login"); };

  useEffect(() => {
    if (!ready) return;
    // Signed-in people may still open /login, to sign in as someone else in this tab.
    if (path === "/login") return;
    if (!user) router.replace("/login");
    else if (user.role === "clinician" && !path.startsWith("/clinician") && !SHARED.includes(path)) router.replace("/clinician");
    else if (user.role === "patient" && path.startsWith("/clinician")) router.replace("/");
  }, [ready, user, path, router]);

  if (!ready) return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
      <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
    </div>
  );
  if (path === "/login") return <>{children}</>;
  if (!user) return null;
  const Shell = user.role === "clinician" ? ClinicianShell : PatientShell;
  return <AuthCtx.Provider value={{ user, refresh, signOut }}><Shell>{children}</Shell></AuthCtx.Provider>;
}
