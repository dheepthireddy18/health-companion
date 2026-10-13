"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { ChevronDown, LogOut, Settings, Siren, User, Users } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { emergencyNumber } from "@/lib/emergency";

/** Avatar in the top-right corner; opens a menu with profile, settings and sign out. */
export default function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-slate-100 hover:text-ink";
  const number = emergencyNumber(user.emergency_number, typeof navigator !== "undefined" ? navigator.language : "en-US");
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-sm transition hover:border-slate-300 hover:shadow">
        <Avatar name={user.name} size={30} />
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:block">{user.name}</span>
        <ChevronDown size={16} className={`text-ink-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 origin-top-right animate-pop-in rounded-2xl border border-slate-200 bg-white p-2 shadow-lift">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <Avatar name={user.name} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-brand-700">{user.role}</span>
            </div>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link role="menuitem" href="/profile" className={item} onClick={() => setOpen(false)}><User size={18} /> My profile</Link>
          <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}><Settings size={18} /> Settings</Link>
          {user.role === "patient" && (
            <a role="menuitem" href={`tel:${number}`} className={`${item} !text-rose-700 hover:!bg-rose-50`}><Siren size={18} /> Emergency: call {number}</a>
          )}
          <div className="my-1 h-px bg-slate-100" />
          <Link role="menuitem" href="/login" className={item} onClick={() => setOpen(false)}><Users size={18} /> Switch account</Link>
          <button role="menuitem" onClick={signOut} className={item}><LogOut size={18} /> Sign out</button>
        </div>
      )}
    </div>
  );
}
