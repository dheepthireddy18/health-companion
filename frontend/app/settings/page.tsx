"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import GoalInput from "@/components/GoalInput";
import { useToast } from "@/components/Toast";
import { Bell, LogOut, Siren, Sparkles, Target, Users, Volume } from "@/components/icons";
import { Btn, Card, Field, PageTitle, Toggle } from "@/components/ui";
import { patch } from "@/lib/api";
import { emergencyNumber } from "@/lib/emergency";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { sfx } from "@/lib/sound";

export default function SettingsPage() {
  const { user, refresh, signOut } = useAuth();
  const toast = useToast();
  const prefs = usePrefs();
  const patient = user.role === "patient";
  const [number, setNumber] = useState(user.emergency_number ?? "");
  useEffect(() => { setNumber(user.emergency_number ?? ""); }, [user.emergency_number]);

  const saveNumber = async () => {
    if (number.trim() === (user.emergency_number ?? "")) return;
    try { await patch("/auth/me", { emergency_number: number.trim() }); await refresh(); toast("Emergency number saved"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); }
  };
  const setStatus = async (change: { available?: boolean; on_call?: boolean }, note: string) => {
    try { await patch("/auth/me", change); await refresh(); toast(note); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not save", "error"); }
  };
  const toggleReminders = async (on: boolean) => {
    if (on && typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission();
    await patch("/auth/me", { notifications_enabled: on });
    await refresh();
  };

  return (
    <>
      <PageTitle eyebrow="Settings" sub="Preferences for this device and your account.">Settings</PageTitle>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card delay={60} title="Experience" icon={<Sparkles size={16} className="text-violet-500" />}>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center gap-3 pb-3">
              <div className="flex-1">
                <Toggle checked={prefs.sound} label="Sound effects" hint="Streak chimes, check-ins and sent messages."
                  onChange={(on) => { setPrefs({ sound: on }); if (on) setTimeout(sfx.chime, 50); }} />
              </div>
              <Btn size="sm" variant="secondary" disabled={!prefs.sound} onClick={() => sfx.fanfare()} aria-label="Play a test sound"><Volume size={16} /></Btn>
            </div>
            <div className="pt-3">
              <Toggle checked={prefs.motion} label="Animations" hint="Turn off for a calmer, still interface." onChange={(on) => setPrefs({ motion: on })} />
            </div>
          </div>
        </Card>

        {!patient && (
          <Card delay={100} title="Availability" icon={<Users size={16} className="text-brand-600" />}>
            <div className="divide-y divide-slate-100">
              <div className="pb-3">
                <Toggle checked={user.available !== false} label="Available to patients"
                  hint="Turn off when you're away. Your patients are pointed to on-call doctors meanwhile."
                  onChange={(on) => setStatus(on ? { available: true } : { available: false, on_call: false }, on ? "You're available" : "Marked as away")} />
              </div>
              <div className="pt-3">
                <Toggle checked={!!user.on_call && user.available !== false} label="On call"
                  hint="Cover for colleagues who are away: their patients see you as the on-call doctor."
                  onChange={(on) => setStatus(on ? { on_call: true, available: true } : { on_call: false }, on ? "You're on call" : "Off call")} />
              </div>
            </div>
          </Card>
        )}

        {patient && (
          <Card delay={100} title="Reminders" icon={<Bell size={16} className="text-amber-500" />}>
            <Toggle checked={user.notifications_enabled} onChange={toggleReminders} label="Medicine reminders"
              hint="Repeats every 30 minutes until a dose is marked. The app must be open in a tab or installed window." />
          </Card>
        )}

        {patient && (
          <Card delay={140} title="Daily goals" icon={<Target size={16} className="text-brand-600" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <GoalInput label="Calories" unit="kcal" min={800} max={4500} value={user.calorie_goal}
                onSave={async (n) => { await patch("/auth/me", { calorie_goal: n }); await refresh(); }} />
              <GoalInput label="Activity" unit="min" min={0} max={300} value={user.activity_goal_min}
                onSave={async (n) => { await patch("/auth/me", { activity_goal_min: n }); await refresh(); }} />
            </div>
          </Card>
        )}

        {patient && (
          <Card delay={180} title="Emergency number" icon={<Siren size={16} className="text-rose-500" />}>
            <Field label="Local emergency number" hint="Used by “Emergency” in your profile menu. Saves when you leave the box.">
              <input value={number} onChange={(e) => setNumber(e.target.value)} onBlur={saveNumber}
                placeholder={emergencyNumber(null, typeof navigator !== "undefined" ? navigator.language : "en-US")} />
            </Field>
          </Card>
        )}

        <Card delay={220} title="Account" icon={<LogOut size={16} className="text-ink-muted" />}>
          <p className="mb-4 text-sm text-ink-muted">Signed in as <b className="text-ink">{user.email}</b></p>
          <Btn variant="secondary" className="w-full" onClick={signOut}><LogOut size={16} /> Sign out</Btn>
        </Card>
      </div>
    </>
  );
}
