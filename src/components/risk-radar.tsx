"use client";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BAND_META, usd } from "@/lib/format";
import type { Band, Flag } from "@/lib/types";

export interface RadarPoint {
  id: string;
  name: string;
  arr: number;
  score: number;
  prob: number;
  band: Band;
  flag: Flag;
  href?: string;
}

const W = 860;
const H = 470;
const M = { l: 56, r: 24, t: 24, b: 48 };
const X0 = 30;
const X1 = 100;

export function RiskRadar({ points, onSelect }: { points: RadarPoint[]; onSelect?: (id: string) => void }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<RadarPoint | null>(null);
  const maxArr = Math.max(...points.map((p) => p.arr), 1);
  const x = (s: number) => M.l + ((Math.max(X0, s) - X0) / (X1 - X0)) * (W - M.l - M.r);
  const y = (p: number) => H - M.b - p * (H - M.t - M.b);
  const r = (arr: number) => 5 + Math.sqrt(arr / maxArr) * 17;
  const sorted = useMemo(() => [...points].sort((a, b) => b.arr - a.arr), [points]);
  const sweepDur = 1.6;

  const go = (p: RadarPoint) => (onSelect ? onSelect(p.id) : p.href && router.push(p.href));

  return (
    <div className="overflow-x-auto -mx-1 px-1">
    <div className="relative min-w-[620px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Risk radar: health score against model churn probability, bubble size is ARR">
        <defs>
          <linearGradient id="sweep" x1="0" x2="1">
            <stop offset="0" stopColor="var(--lilac)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--lilac)" stopOpacity="0.35" />
          </linearGradient>
          <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--lilac)" strokeOpacity="0.16" strokeWidth="2" />
          </pattern>
        </defs>

        {/* silent churn zone */}
        <rect x={x(70)} y={y(1)} width={x(100) - x(70)} height={y(0.4) - y(1)} fill="url(#hatch)" />
        <text x={x(100) - 10} y={y(1) + 22} textAnchor="end" className="fill-lilac-ink" style={{ fontSize: 14, fontWeight: 600 }}>
          Looks healthy, likely to leave
        </text>
        <text x={x(100) - 10} y={y(1) + 40} textAnchor="end" className="fill-ink-3" style={{ fontSize: 12 }}>
          score 70 or higher, churn 40% or higher
        </text>

        {/* grid */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => (
          <g key={p}>
            <line x1={M.l} x2={W - M.r} y1={y(p)} y2={y(p)} stroke="var(--line-soft)" strokeDasharray={p === 0.4 ? "4 4" : undefined} strokeOpacity={p === 0.4 ? 1 : 0.7} />
            <text x={M.l - 10} y={y(p) + 4} textAnchor="end" className="fill-ink-3 num" style={{ fontSize: 11 }}>{Math.round(p * 100)}%</text>
          </g>
        ))}
        {[30, 50, 70, 90, 100].map((s) => (
          <g key={s}>
            <line x1={x(s)} x2={x(s)} y1={M.t} y2={H - M.b} stroke="var(--line-soft)" strokeDasharray={s === 70 || s === 50 ? "4 4" : undefined} strokeOpacity={0.7} />
            <text x={x(s)} y={H - M.b + 18} textAnchor="middle" className="fill-ink-3 num" style={{ fontSize: 11 }}>{s}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle" className="fill-ink-2" style={{ fontSize: 12 }}>Health score (rules-based)</text>
        <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-2" style={{ fontSize: 12 }}>Churn probability (model)</text>

        {/* sweep */}
        {!reduce && (
          <motion.rect
            y={M.t}
            height={H - M.t - M.b}
            width={90}
            fill="url(#sweep)"
            initial={{ x: M.l - 90, opacity: 1 }}
            animate={{ x: W - M.r, opacity: [1, 1, 0] }}
            transition={{ duration: sweepDur, ease: "easeInOut", times: [0, 0.9, 1] }}
            pointerEvents="none"
          />
        )}

        {sorted.map((p) => {
          const cx = x(p.score);
          const cy = y(p.prob);
          const rad = r(p.arr);
          const delay = reduce ? 0 : ((cx - M.l) / (W - M.l - M.r)) * sweepDur * 0.95;
          const color = BAND_META[p.band].color;
          return (
            <motion.g
              key={p.id}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay, type: "spring", stiffness: 260, damping: 18 }}
              style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box" }}
            >
              <a
                href={p.href ?? "#"}
                onClick={(e) => { e.preventDefault(); go(p); }}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(null)}
                aria-label={`${p.name}: health ${p.score}, churn ${Math.round(p.prob * 100)}%, ARR ${usd(p.arr)}`}
                className="cursor-pointer outline-none"
              >
                <circle cx={cx} cy={cy} r={rad + 10} fill="transparent" />
                {p.flag === "silent-churn" && (
                  <>
                    {!reduce && (
                      <motion.circle
                        cx={cx} cy={cy} r={rad + 4} fill="none" stroke="var(--lilac-ink)" strokeWidth={1.5}
                        animate={{ r: [rad + 4, rad + 14], opacity: [0.9, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, delay: delay + 0.4, ease: "easeOut" }}
                      />
                    )}
                    <circle cx={cx} cy={cy} r={rad + 4} fill="none" stroke="var(--lilac-ink)" strokeWidth={2} />
                  </>
                )}
                <circle cx={cx} cy={cy} r={rad} fill={color} fillOpacity={hover?.id === p.id ? 0.95 : 0.7} stroke="var(--surface)" strokeWidth={2} />
              </a>
            </motion.g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 panel-strong px-3 py-2 text-sm min-w-[200px]"
          style={{
            left: `${(x(hover.score) / W) * 100}%`,
            top: `${(y(hover.prob) / H) * 100}%`,
            transform: `translate(${x(hover.score) > W * 0.65 ? "calc(-100% - 16px)" : "16px"}, -50%)`,
          }}
        >
          <p className="font-semibold">{hover.name}</p>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-ink-2">
            <dt>ARR</dt><dd className="num text-ink">{usd(hover.arr)}</dd>
            <dt>Health score</dt><dd className="num text-ink">{hover.score}</dd>
            <dt>Churn probability</dt><dd className="num text-ink">{Math.round(hover.prob * 100)}%</dd>
          </dl>
          {hover.flag === "silent-churn" && <p className="mt-1.5 text-lilac-ink text-xs">Silent churn flag</p>}
        </div>
      )}
    </div>
    </div>
  );
}
