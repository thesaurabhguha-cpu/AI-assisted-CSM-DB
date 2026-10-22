"use client";
import { usd } from "@/lib/format";

// Isotype strip: one glyph per $25k of ARR, grouped by what the co-pilot thinks.
// Clicking a group filters the account table.
export interface IsoGroup { key: string; label: string; detail: string; arr: number; color: string; ring?: boolean }

const UNIT = 25_000;

export function Isotype({ groups, active, onPick }: { groups: IsoGroup[]; active?: string | null; onPick?: (key: string | null) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((g) => {
        const n = Math.max(1, Math.round(g.arr / UNIT));
        const on = active === g.key;
        const dim = !!active && !on;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onPick?.(on ? null : g.key)}
            aria-pressed={on}
            title={on ? "Show all accounts" : `Show ${g.label.toLowerCase()} accounts in the table`}
            className={`min-w-0 text-left rounded-xl border p-3 transition ${on ? "border-lilac bg-lilac/10" : "border-transparent hover:border-line"} ${dim ? "opacity-45" : ""}`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{g.label}</span>
              <span className="num text-ink-2">{usd(g.arr)}</span>
            </span>
            <span className="block text-xs text-ink-3 mt-0.5">{g.detail}</span>
            <span className="mt-3 flex flex-wrap gap-[3px]" role="img" aria-label={`${g.label}: ${usd(g.arr)}, ${n} glyphs`}>
              {Array.from({ length: n }, (_, i) => (
                <span
                  key={i}
                  className="block h-[11px] w-[11px] rounded-[3px]"
                  style={{
                    background: g.ring ? "transparent" : g.color,
                    border: g.ring ? `2px solid ${g.color}` : undefined,
                    opacity: g.ring ? 1 : 0.85,
                  }}
                />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
