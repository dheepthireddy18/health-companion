"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import ProfileMenu from "@/components/ProfileMenu";
import { Heart } from "@/components/icons";

export interface NavItem { href: string; label: string; icon: ReactNode; exact?: boolean }

/** Sticky, frosted header: logo, section links (scrollable row on phones), profile menu on the right. */
export default function TopBar({ items, home, tag }: { items: NavItem[]; home: string; tag?: string }) {
  const path = usePathname() ?? "/";
  const links = items.map((i) => {
    const active = i.exact ? path === i.href : path.startsWith(i.href);
    return (
      <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
        className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
          active ? "bg-ink text-white shadow-sm" : "text-ink-soft hover:bg-slate-100 hover:text-ink"}`}>
        {i.icon}{i.label}
      </Link>
    );
  });
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href={home} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-md">
            <Heart size={18} className="fill-white/90" />
          </span>
          <span className="text-[1.05rem] font-extrabold tracking-tight">Companion</span>
          {tag && <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted sm:inline">{tag}</span>}
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">{links}</nav>
        <div className="ml-auto"><ProfileMenu /></div>
      </div>
      <nav aria-label="Main" className="scrollbar-thin flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">{links}</nav>
    </header>
  );
}
