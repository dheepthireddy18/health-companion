"use client";
import { useMemo, type CSSProperties } from "react";

/** A ring of emoji/stars that fly outward and fade. Re-mount (change `key`) to fire again. */
export default function Burst({ count = 14, glyphs = ["⭐", "🔥", "✨", "⭐", "💫"], spread = 120, className = "" }: {
  count?: number; glyphs?: string[]; spread?: number; className?: string;
}) {
  const parts = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = spread * (0.55 + Math.random() * 0.6);
    return {
      glyph: glyphs[i % glyphs.length],
      style: {
        "--tx": `${Math.cos(angle) * dist}px`, "--ty": `${Math.sin(angle) * dist}px`,
        "--s": (0.7 + Math.random() * 0.8).toFixed(2), "--r": `${Math.round(Math.random() * 360 - 180)}deg`,
        animationDelay: `${Math.round(Math.random() * 120)}ms`, fontSize: `${14 + Math.random() * 14}px`,
      } as CSSProperties,
    };
  }), [count, glyphs, spread]);
  return (
    <span aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 ${className}`}>
      {parts.map((p, i) => <span key={i} className="absolute left-0 top-0 animate-burst opacity-0" style={p.style}>{p.glyph}</span>)}
    </span>
  );
}
