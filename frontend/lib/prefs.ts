"use client";
import { useEffect, useState } from "react";

/** Per-device preferences (not health data), kept in the browser so they work for both roles. */
export interface Prefs { sound: boolean; motion: boolean }
const KEY = "hc_prefs";
const DEFAULTS: Prefs = { sound: true, motion: true };
const EVENT = "hc-prefs";

export function getPrefs(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; }
}

export function setPrefs(p: Partial<Prefs>) {
  const next = { ...getPrefs(), ...p };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  applyMotion(next);
  window.dispatchEvent(new Event(EVENT));
}

export function applyMotion(p: Prefs = getPrefs()) {
  if (typeof document !== "undefined") document.documentElement.dataset.motion = p.motion ? "on" : "off";
}

export function usePrefs(): Prefs {
  const [prefs, set] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    const sync = () => set(getPrefs());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return prefs;
}

export const motionAllowed = () =>
  getPrefs().motion && !(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
