"use client";
import { useCallback, useEffect, useState } from "react";

/*
 * Each tab keeps its own sign-in (sessionStorage), so a patient and a clinician can be signed in side by side in
 * two tabs. The latest sign-in is also kept in localStorage so a newly opened tab starts signed in.
 */
const TOKEN_KEY = "hc_token";
export const getToken = () => {
  try {
    const own = sessionStorage.getItem(TOKEN_KEY);
    if (own) return own;
    const latest = localStorage.getItem(TOKEN_KEY);
    if (latest) sessionStorage.setItem(TOKEN_KEY, latest);
    return latest;
  } catch { return null; }
};
export const setToken = (t: string | null) => {
  try {
    const own = sessionStorage.getItem(TOKEN_KEY);
    if (t) { sessionStorage.setItem(TOKEN_KEY, t); localStorage.setItem(TOKEN_KEY, t); return; }
    sessionStorage.removeItem(TOKEN_KEY);
    if (localStorage.getItem(TOKEN_KEY) === own) localStorage.removeItem(TOKEN_KEY); // leave other tabs' sign-in alone
  } catch {}
};

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    setToken(null);
    if (typeof window !== "undefined" && window.location.pathname !== "/login") window.location.href = "/login";
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const post = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path: string) => api(path, { method: "DELETE" });

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

/* ---------- date helpers (local time, not UTC) ---------- */
const p2 = (n: number) => String(n).padStart(2, "0");
export const localDate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const localDateTime = (d: Date = new Date()) => `${localDate(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDate(d);
};
export const niceDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
export const niceTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${p2(m)} ${h < 12 ? "AM" : "PM"}`;
};
/** "just now", "5m", "3h", "2d", then a short date. */
export const ago = (iso: string, now: Date = new Date()) => {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return `${Math.round(mins / 1440)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
