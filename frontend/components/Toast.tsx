"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle } from "@/components/icons";

type Toast = { id: number; text: string; tone: "ok" | "error" };
const Ctx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Short confirmations that slide in at the bottom and leave on their own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className={`pointer-events-auto flex animate-slide-in items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lift
              ${t.tone === "ok" ? "bg-ink text-white" : "bg-rose-600 text-white"}`}>
            {t.tone === "ok" && <CheckCircle size={18} className="text-brand-300" />}{t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
