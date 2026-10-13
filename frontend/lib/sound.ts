"use client";
import { getPrefs } from "@/lib/prefs";

/**
 * Tiny synthesized sound effects (Web Audio, no audio files). Browsers only allow sound after the person has
 * interacted with the page, so a blocked context fails silently.
 */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined" || !getPrefs().sound) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx.state === "running" ? ctx : null;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  /** Rising tick while a counter climbs; step 0..1 sets the pitch. */
  tick: (step: number) => tone(520 + step * 520, 0, 0.07, "triangle", 0.06),
  /** Bright three-note chime when a streak lands. */
  chime: () => { tone(784, 0, 0.18); tone(988, 0.09, 0.2); tone(1319, 0.18, 0.4, "sine", 0.1); },
  /** Short pop when something is added. */
  pop: () => { tone(660, 0, 0.06, "square", 0.04); tone(990, 0.04, 0.09, "sine", 0.08); },
  /** Fanfare for milestones. */
  fanfare: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.35, "triangle", 0.08)),
  /** Soft send whoosh for chat. */
  send: () => { tone(880, 0, 0.08, "sine", 0.06); tone(1175, 0.05, 0.12, "sine", 0.05); },
};
