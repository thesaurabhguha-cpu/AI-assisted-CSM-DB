import { usd } from "@/lib/format";

// Isotype strip: one glyph per $25k of ARR, grouped by what the co-pilot thinks.
export interface IsoGroup { key: string; label: string; detail: string; arr: number; color: string; ring?: boolean }

const UNIT = 25_000;

export function Isotype({ groups }: { groups: IsoGroup[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map((g) => {
        const n = Math.max(1, Math.round(g.arr / UNIT));
        return (
          <figure key={g.key} className="min-w-0">
            <figcaption className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{g.label}</span>
              <span className="num text-ink-2">{usd(g.arr)}</span>
            </figcaption>
            <p className="text-xs text-ink-3 mt-0.5">{g.detail}</p>
            <div className="mt-3 flex flex-wrap gap-[3px]" role="img" aria-label={`${g.label}: ${usd(g.arr)}, ${n} glyphs`}>
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
            </div>
          </figure>
        );
      })}
    </div>
  );
}
