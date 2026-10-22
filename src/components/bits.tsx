import { BAND_META, FLAG_META } from "@/lib/format";
import type { Band, Flag } from "@/lib/types";

export function BandTag({ band, className = "" }: { band: Band; className?: string }) {
  const m = BAND_META[band];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className}`} style={{ color: m.color }}>
      <span aria-hidden="true" className="text-[10px]">{m.icon}</span>
      <span className="text-ink-2">{m.label}</span>
    </span>
  );
}

export function FlagTag({ flag }: { flag: Flag }) {
  if (!flag) return null;
  const m = FLAG_META[flag];
  const silent = flag === "silent-churn";
  return (
    <span
      title={m.explain}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${silent ? "border-lilac/60 text-lilac-ink bg-lilac/10" : "border-line text-ink-2"}`}
    >
      <span aria-hidden="true">{silent ? "◎" : "◌"}</span>
      {m.label}
    </span>
  );
}

export function HealthRing({ score, band, size = 120, stroke = 10, label = true }: { score: number; band: Band; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = BAND_META[band].color;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Health score ${score} of 100, ${BAND_META[band].label}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-draw"
        style={{ ["--c" as string]: c }}
      />
      {label && (
        <>
          <text x="50%" y="50%" dy="0.1em" textAnchor="middle" className="fill-ink num" style={{ fontSize: size * 0.3, fontWeight: 500 }}>{score}</text>
          <text x="50%" y="50%" dy={size * 0.22} textAnchor="middle" className="fill-ink-3" style={{ fontSize: size * 0.1 }}>of 100</text>
        </>
      )}
    </svg>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "risk" | "ai" }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={`num text-2xl sm:text-[28px] mt-1 leading-none ${tone === "risk" ? "text-brick" : tone === "ai" ? "text-lilac-ink" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-xs text-ink-3 mt-1.5">{sub}</p>}
    </div>
  );
}
