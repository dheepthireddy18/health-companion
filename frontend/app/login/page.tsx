"use client";
import { useEffect, useState, type ReactNode } from "react";
import GoogleSignIn from "@/components/GoogleSignIn";
import { Eye, EyeOff, Heart, Lock, Mail, Phone, User as UserIcon, Users } from "@/components/icons";
import { Avatar, Btn, Chips, ErrorNote } from "@/components/ui";
import { api, getToken, post, setToken } from "@/lib/api";
import { passwordScore } from "@/lib/password";
import type { User } from "@/lib/types";

type Role = User["role"];
type Mode = "signin" | "register";
type Session = { token: string; user: User };

const DEMO: Record<Role, { email: string; password: string }> = {
  patient: { email: "meena.iyer@care.test", password: "patient123" },
  clinician: { email: "kavitha.menon@riversidehealth.example", password: "clinician123" },
};
const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"].map((g) => ({ value: g, label: g }));

const STRENGTH = [
  { label: "", bar: "bg-slate-200" }, { label: "Too short", bar: "bg-rose-500" }, { label: "Fair", bar: "bg-amber-500" },
  { label: "Good", bar: "bg-brand-500" }, { label: "Strong", bar: "bg-brand-600" },
];

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<Role>("patient");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [current, setCurrent] = useState<User | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "register") setMode("register");
    if (getToken()) api<User>("/auth/me").then(setCurrent).catch(() => {});
  }, []);

  const attempt = async (fn: () => Promise<Session>) => {
    setBusy(true);
    try {
      const res = await fn();
      setToken(res.token);
      sessionStorage.removeItem("hc_welcomed");
      window.location.href = res.user.role === "clinician" ? "/clinician" : "/";
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); setBusy(false); }
  };
  const switchMode = (m: Mode) => { setMode(m); setError(null); if (m === "register") setRole("patient"); };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f3f6fb] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={`absolute -left-40 -top-40 h-[34rem] w-[34rem] animate-blob rounded-full blur-3xl transition-colors duration-700 ${role === "patient" ? "bg-brand-300/50" : "bg-violet-300/50"}`} />
        <div className="absolute -bottom-40 -right-32 h-[30rem] w-[30rem] animate-blob rounded-full bg-sky-300/40 blur-3xl [animation-delay:-8s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,.07)_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative w-full max-w-[440px] animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lift transition-colors duration-500 ${
            role === "patient" ? "bg-gradient-to-br from-brand-400 to-brand-700" : "bg-gradient-to-br from-violet-500 to-indigo-700"}`}>
            <Heart size={22} className="fill-white/90" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === "signin" ? "Sign in to Companion to continue." : "Start tracking your health in under a minute."}
          </p>
        </div>

        {current && (
          <div className="mb-4 flex animate-slide-in items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-card">
            <Avatar name={current.name} size={36} />
            <p className="min-w-0 flex-1 text-sm"><span className="block truncate font-semibold">Signed in as {current.name}</span>
              <span className="text-xs capitalize text-ink-muted">{current.role} · sign in below to switch this tab</span></p>
            <Btn size="sm" variant="secondary" onClick={() => { window.location.href = current.role === "clinician" ? "/clinician" : "/"; }}>Continue</Btn>
          </div>
        )}
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-lift backdrop-blur-xl sm:p-7">
          <Segmented value={mode} onChange={switchMode} label="Sign in or register"
            options={[{ value: "signin", label: "Sign in" }, { value: "register", label: "Create account" }]} />

          <div key={mode} className="mt-6 animate-fade-up">
            {mode === "signin" ? (
              <SignIn role={role} setRole={(r) => { setRole(r); setError(null); }} busy={busy} error={error}
                onSubmit={(email, password) => attempt(() => post("/auth/login", { email, password, role }))} />
            ) : (
              <Register busy={busy} error={error} onSubmit={(body) => attempt(() => post("/auth/register", body))} />
            )}
          </div>

          <div className="my-6 flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" />
          </div>
          <GoogleSignIn onCredential={(credential) => attempt(() => post("/auth/google", { credential, role: mode === "register" ? "patient" : role }))} />
          <p className="mt-2 text-center text-xs text-ink-muted">
            {mode === "register" || role === "patient" ? "New Google accounts become patient accounts." : "Use the Google account your clinic registered."}
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {mode === "signin" ? <>New to Companion? <TextBtn onClick={() => switchMode("register")}>Create a patient account</TextBtn></>
            : <>Already have an account? <TextBtn onClick={() => switchMode("signin")}>Sign in</TextBtn></>}
        </p>
        <p className="mt-3 text-center text-[0.7rem] text-ink-muted">Companion records your information. It does not give medical advice.</p>
      </div>
    </main>
  );
}

function SignIn({ role, setRole, busy, error, onSubmit }: {
  role: Role; setRole: (r: Role) => void; busy: boolean; error: string | null; onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const clinician = role === "clinician";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(email, password); }} className="space-y-4">
      <div>
        <p className="mb-2 text-[0.8rem] font-semibold text-ink-soft">I am a</p>
        <div role="radiogroup" aria-label="Sign in as" className="grid grid-cols-2 gap-2">
          {([["patient", "Patient", <Heart key="h" size={18} />], ["clinician", "Clinician", <Users key="u" size={18} />]] as [Role, string, ReactNode][]).map(([k, label, ic]) => {
            const on = role === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setRole(k)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${on
                  ? (k === "patient" ? "border-brand-500 bg-brand-50 text-brand-800 ring-4 ring-brand-500/10" : "border-violet-500 bg-violet-50 text-violet-800 ring-4 ring-violet-500/10")
                  : "border-slate-200 bg-white text-ink-muted hover:border-slate-300 hover:text-ink"}`}>
                {ic}{label} login
              </button>
            );
          })}
        </div>
      </div>
      <IconInput icon={<Mail size={16} />} label="Email" type="email" required autoComplete="username" value={email} onChange={setEmail}
        placeholder={clinician ? "you@yourclinic.org" : "you@gmail.com"} />
      <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      <ErrorNote error={error} />
      <Btn type="submit" size="lg" disabled={busy}
        className={`w-full ${clinician ? "!bg-none !bg-violet-600 !shadow-[0_8px_20px_-8px_rgba(124,58,237,.7)] hover:!bg-violet-700" : ""}`}>
        {busy ? "Signing in…" : `Sign in as ${role}`}
      </Btn>
      <button type="button" onClick={() => { setEmail(DEMO[role].email); setPassword(DEMO[role].password); }}
        className="block w-full text-center text-xs font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        Just exploring? Use the demo {role} account
      </button>
    </form>
  );
}

function Register({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (body: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", age: "", gender: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const score = passwordScore(f.password);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: f.name, email: f.email, password: f.password, phone: f.phone || null, age: f.age ? Number(f.age) : null, gender: f.gender || null });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-xl bg-brand-50/80 px-3 py-2 text-xs text-brand-800 ring-1 ring-inset ring-brand-600/10">
        Sign-up is for <b>patients</b>. Clinician accounts are added by your clinic.
      </p>
      <IconInput icon={<UserIcon size={16} />} label="Full name" required minLength={2} autoComplete="name" value={f.name} onChange={set("name")} placeholder="Neha Verma" />
      <IconInput icon={<Mail size={16} />} label="Email" type="email" required autoComplete="email" value={f.email} onChange={set("email")} placeholder="you@gmail.com" />
      <div>
        <PasswordInput value={f.password} onChange={set("password")} autoComplete="new-password" />
        {f.password && (
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">{[1, 2, 3, 4].map((i) =>
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= score ? STRENGTH[score].bar : "bg-slate-200"}`} />)}</div>
            <span className="w-16 text-right text-xs font-semibold text-ink-muted">{score === 1 && f.password.length >= 8 ? "Weak" : STRENGTH[score].label}</span>
          </div>
        )}
        <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <IconInput icon={<Phone size={16} />} label="Phone (optional)" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} placeholder="+1 (732) 555-0100" />
        <IconInput label="Age" type="number" inputMode="numeric" min={13} max={120} value={f.age} onChange={set("age")} placeholder="25" />
      </div>
      <div>
        <p className="mb-1.5 text-[0.8rem] font-semibold text-ink-soft">Gender (optional)</p>
        <Chips label="Gender" options={GENDERS} value={f.gender} onChange={(v) => set("gender")(f.gender === v ? "" : v)} />
      </div>
      <ErrorNote error={error} />
      <Btn type="submit" size="lg" disabled={busy || f.password.length < 8 || !f.name.trim() || !f.email} className="w-full">
        {busy ? "Creating account…" : "Create patient account"}
      </Btn>
    </form>
  );
}

/* ---------- small pieces ---------- */
function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="tablist" aria-label={label} className="relative grid rounded-2xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span aria-hidden className="absolute bottom-1 top-1 rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, left: "0.25rem", transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} type="button" onClick={() => onChange(o.value)}
          className={`relative h-10 rounded-xl text-sm font-semibold transition-colors ${o.value === value ? "text-ink" : "text-ink-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function IconInput({ icon, label, onChange, ...rest }: {
  icon?: ReactNode; label: string; onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-soft">{label}</span>
      <span className="relative block">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input {...rest} onChange={(e) => onChange(e.target.value)} className={icon ? "!pl-10" : ""} />
      </span>
    </label>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-soft">Password</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></span>
        <input type={show ? "text" : "password"} required autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••" className="!pl-10 !pr-11" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

const TextBtn = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="font-semibold text-brand-700 underline-offset-4 hover:underline">{children}</button>
);
