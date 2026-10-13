"use client";
import { useAuth } from "@/components/AuthGate";
import GoalInput from "@/components/GoalInput";
import { Btn, Card, Field, PageTitle } from "@/components/ui";
import { patch } from "@/lib/api";
import { emergencyNumber } from "@/lib/emergency";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const [number, setNumber] = useState(user.emergency_number ?? "");
  const [note, setNote] = useState("Used by the emergency call button. Saves automatically.");
  useEffect(() => { if (!user.emergency_number) setNumber(""); }, [user.emergency_number]);

  const saveNumber = async () => {
    if (number.trim() === (user.emergency_number ?? "")) return;
    await patch("/auth/me", { emergency_number: number.trim() });
    await refresh(); setNote("Saved ✔");
  };

  return (
    <>
      <PageTitle>Settings</PageTitle>
      <Card title="Emergency number">
        <Field label="Local emergency number" hint={note}>
          <input value={number} onChange={(e) => setNumber(e.target.value)} onBlur={saveNumber}
            placeholder={emergencyNumber(null, typeof navigator !== "undefined" ? navigator.language : "en-US")} />
        </Field>
      </Card>
      <Card title="Goals">
        <div className="grid gap-4 sm:grid-cols-2">
          <GoalInput label="Daily calories" unit="kcal" min={800} max={4500} value={user.calorie_goal}
            onSave={async (n) => { await patch("/auth/me", { calorie_goal: n }); await refresh(); }} />
          <GoalInput label="Daily activity" unit="minutes" min={0} max={300} value={user.activity_goal_min}
            onSave={async (n) => { await patch("/auth/me", { activity_goal_min: n }); await refresh(); }} />
        </div>
      </Card>
      <Btn variant="secondary" className="w-full" onClick={signOut}>Sign out</Btn>
    </>
  );
}
