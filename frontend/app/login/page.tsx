"use client";
import { useState } from "react";
import { Btn, Card, ErrorNote, Field, PageTitle } from "@/components/ui";
import { post, setToken } from "@/lib/api";
import type { User } from "@/lib/types";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post<{ token: string; user: User }>("/auth/login", { email, password });
      setToken(r.token);
      sessionStorage.removeItem("hc_welcomed");
      window.location.href = r.user.role === "clinician" ? "/clinician" : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <PageTitle sub="Sign in to continue">Health Companion</PageTitle>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <ErrorNote error={error} />
          <Btn type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Btn>
        </form>
      </Card>
      <Card title="Demo accounts">
        <p>Patient: <b>meena@example.com</b> / patient123</p>
        <p>Clinician: <b>dr.nair@clinic.test</b> / clinician123</p>
      </Card>
    </main>
  );
}
