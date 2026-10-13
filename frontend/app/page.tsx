"use client";
import { useState } from "react";
import EnergyCard from "@/components/EnergyCard";
import { Btn, Card, ErrorNote, PageTitle } from "@/components/ui";
import { localDate, post, useFetch } from "@/lib/api";
import type { Home, Streak } from "@/lib/types";
import { useAuth } from "@/components/AuthGate";

const tone = {
  green: "border-green-700 bg-green-100 text-green-900",
  amber: "border-yellow-700 bg-yellow-100 text-yellow-900",
  red: "border-red-700 bg-red-100 text-red-900",
};
const word = { green: "✔ Doing well", amber: "! Keep an eye", red: "⚠ Needs attention" };

function StreakCard({ s }: { s: Streak }) {
  const stars = "⭐".repeat(Math.min(5, Math.floor(s.current / 5)));
  return (
    <Card title="Check-in streak">
      <div className={`rounded-xl p-4 text-center ${s.milestone ? "border-4 border-amber-500 bg-amber-100" : "bg-slate-100"}`}>
        <p className="text-5xl font-extrabold">🔥 {s.current}</p>
        <p className="text-lg font-semibold">{s.current === 1 ? "day" : "days"} in a row</p>
        {s.milestone && <p className="mt-2 text-xl font-extrabold text-amber-900">🎉 {s.current}-day milestone! {stars}</p>}
      </div>
      <p className="mt-3">
        {s.checked_in_today ? "You have checked in today. " : "Check in today to keep your streak. "}
        Next milestone: day {s.next_milestone}. Best streak: {s.longest}.
      </p>
    </Card>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const day = localDate();
  const { data, error, reload } = useFetch<Home>(`/home?day=${day}`);
  const [busy, setBusy] = useState(false);

  const checkIn = async () => {
    setBusy(true);
    try { await post(`/checkin?day=${day}`); await reload(); } finally { setBusy(false); }
  };

  return (
    <>
      <PageTitle sub="Your day at a glance">How am I today, {user.name.split(" ")[0]}?</PageTitle>
      <ErrorNote error={error} />
      {data && (
        <>
          <section className={`rounded-2xl border-4 p-6 ${tone[data.status.level]}`} aria-label="Today's status">
            <p className="text-2xl font-extrabold">{word[data.status.level]}</p>
            <p className="mt-1 text-lg">{data.status.text}</p>
          </section>
          <StreakCard s={data.streak} />
          <EnergyCard e={data.energy} />
          <Btn onClick={checkIn} disabled={busy || data.streak.checked_in_today} className="w-full !min-h-[4rem] text-xl">
            {data.streak.checked_in_today ? "✔ Checked in today" : "Check in for today"}
          </Btn>
        </>
      )}
    </>
  );
}
