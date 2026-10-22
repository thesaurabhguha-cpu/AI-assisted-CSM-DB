"use client";
import { useState } from "react";

// 52-week active-user line with event markers and a crosshair tooltip.
export function UsageChart({ weekly, seats, events }: { weekly: number[]; seats: number; events: { weeksAgo: number; label: string }[] }) {
  const W = 1160, H = 300, M = { l: 48, r: 16, t: 18, b: 30 };
  const max = Math.max(seats, ...weekly) * 1.05 || 1;
  const n = weekly.length;
  const x = (i: number) => M.l + (i / (n - 1)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / max) * (H - M.t - M.b);
  const path = weekly.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${path}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const [hi, setHi] = useState<number | null>(null);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none"
        role="img"
        aria-label={`Weekly active users over 52 weeks, now ${weekly[n - 1]} of ${seats} seats`}
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - M.l) / (W - M.l - M.r)) * (n - 1));
          setHi(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerLeave={() => setHi(null)}
      >
        <defs>
          <linearGradient id="ua" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--lilac)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--lilac)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 num" style={{ fontSize: 11 }}>{t}</text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={y(seats)} y2={y(seats)} stroke="var(--ink-3)" strokeDasharray="3 5" />
        <text x={W - M.r} y={y(seats) - 6} textAnchor="end" className="fill-ink-3" style={{ fontSize: 11 }}>{seats} seats purchased</text>
        <path d={area} fill="url(#ua)" />
        <path d={path} fill="none" stroke="var(--lilac-ink)" strokeWidth={2} strokeLinejoin="round" />
        {events.map((ev) => {
          const i = n - 1 - ev.weeksAgo;
          if (i < 0) return null;
          return (
            <g key={ev.label + ev.weeksAgo}>
              <line x1={x(i)} x2={x(i)} y1={M.t} y2={H - M.b} stroke="var(--ochre)" strokeOpacity={0.55} strokeDasharray="2 3" />
              <circle cx={x(i)} cy={M.t + 4} r={4} fill="var(--ochre)" />
            </g>
          );
        })}
        {[0, 13, 26, 39, 51].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-ink-3" style={{ fontSize: 11 }}>
            {i === 51 ? "now" : `${51 - i}w ago`}
          </text>
        ))}
        {hi !== null && (
          <g pointerEvents="none">
            <line x1={x(hi)} x2={x(hi)} y1={M.t} y2={H - M.b} stroke="var(--ink-2)" strokeOpacity={0.5} />
            <circle cx={x(hi)} cy={y(weekly[hi])} r={4.5} fill="var(--lilac-ink)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hi !== null && (
        <div
          className="pointer-events-none absolute top-2 panel-strong px-3 py-1.5 text-xs"
          style={{ left: `${(x(hi) / W) * 100}%`, transform: x(hi) > W * 0.7 ? "translateX(calc(-100% - 10px))" : "translateX(10px)" }}
        >
          <p className="text-ink-3">{51 - hi === 0 ? "This week" : `${51 - hi} weeks ago`}</p>
          <p className="num text-ink">{weekly[hi]} active users</p>
          {events.filter((e) => e.weeksAgo === 51 - hi).map((e) => <p key={e.label} className="text-ochre">{e.label}</p>)}
        </div>
      )}
      {events.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
          {events.map((e) => (
            <li key={e.label + e.weeksAgo} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ochre" aria-hidden="true" />
              {e.label}, {e.weeksAgo === 0 ? "this week" : `${e.weeksAgo}w ago`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
