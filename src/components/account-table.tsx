"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BandTag, FlagTag } from "./bits";
import { usd } from "@/lib/format";
import type { Band, Flag } from "@/lib/types";

export interface Row {
  id: string;
  name: string;
  segment: string;
  industry: string;
  arr: number;
  score: number;
  band: Band;
  prob: number;
  flag: Flag;
  arrAtRisk: number;
  daysToRenewal: number;
  group?: string;
  href?: string;
}

type Key = "name" | "arr" | "score" | "prob" | "arrAtRisk" | "daysToRenewal";
const COLS: { key: Key; label: string; num?: boolean }[] = [
  { key: "name", label: "Account" },
  { key: "arr", label: "ARR", num: true },
  { key: "score", label: "Health", num: true },
  { key: "prob", label: "Churn", num: true },
  { key: "arrAtRisk", label: "ARR at risk", num: true },
  { key: "daysToRenewal", label: "Renewal", num: true },
];

export function AccountTable({
  rows,
  onSelect,
  selected,
  group,
  groupLabel,
  onClearGroup,
}: {
  rows: Row[];
  onSelect?: (id: string) => void;
  selected?: string | null;
  group?: string | null;
  groupLabel?: string;
  onClearGroup?: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "arrAtRisk", dir: -1 });
  const [filter, setFilter] = useState<"all" | "flagged" | Band>("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = rows.filter(
      (r) =>
        (filter === "all" ? true : filter === "flagged" ? r.flag !== null : r.band === filter) &&
        (!group || r.group === group) &&
        (!needle || [r.name, r.segment, r.industry, r.band, r.flag ?? ""].some((v) => v.toLowerCase().includes(needle))),
    );
    return [...f].sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      return (typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * sort.dir;
    });
  }, [rows, sort, filter, group, q]);

  const FILTERS: { k: typeof filter; label: string }[] = [
    { k: "all", label: `All ${rows.length}` },
    { k: "flagged", label: `Flagged ${rows.filter((r) => r.flag).length}` },
    { k: "at-risk", label: "At risk" },
    { k: "watch", label: "Watch" },
    { k: "healthy", label: "Healthy" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
      <label className="relative grow sm:grow-0 sm:w-72">
        <span className="sr-only">Search accounts</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search account, segment, industry"
          className="w-full rounded-full border border-line bg-transparent px-4 py-1.5 text-sm placeholder:text-ink-3 focus:border-lilac outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter accounts">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            aria-pressed={filter === f.k}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${filter === f.k ? "border-lilac bg-lilac/15 text-ink" : "border-line text-ink-2 hover:text-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {group && (
        <button onClick={onClearGroup} className="rounded-full border border-lilac/60 bg-lilac/10 px-3 py-1 text-sm text-lilac-ink hover:brightness-110">
          {groupLabel ?? group} ×
        </button>
      )}
      <span className="ml-auto text-xs text-ink-3 num" aria-live="polite">{shown.length} shown</span>
      </div>
      <div className="overflow-x-auto panel">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-ink-3 border-b border-line-soft">
              {COLS.map((c) => (
                <th key={c.key} scope="col" className={`font-normal px-4 py-3 ${c.num ? "text-right" : ""}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button
                    className="hover:text-ink inline-flex items-center gap-1"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.key === "name" || c.key === "daysToRenewal" ? 1 : -1 }))}
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-[10px] w-2">{sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                  </button>
                </th>
              ))}
              <th scope="col" className="font-normal px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const content = (
                <>
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className="block text-xs text-ink-3">{[r.segment, r.industry].filter(Boolean).join(", ")}</span>
                </>
              );
              return (
                <tr key={r.id} className={`border-b border-line-soft/60 last:border-0 hover:bg-white/[0.025] ${selected === r.id ? "bg-lilac/10" : ""}`}>
                  <td className="px-4 py-3">
                    {r.href ? (
                      <Link href={r.href} className="block hover:underline underline-offset-4 decoration-line">{content}</Link>
                    ) : (
                      <button onClick={() => onSelect?.(r.id)} className="text-left hover:underline underline-offset-4 decoration-line">{content}</button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right num">{usd(r.arr)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-2 justify-end">
                      <Meter v={r.score / 100} color={`var(--${r.band === "healthy" ? "moss" : r.band === "watch" ? "ochre" : "brick"})`} />
                      <span className="num w-7 text-right">{r.score}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right num">{Math.round(r.prob * 100)}%</td>
                  <td className="px-4 py-3 text-right num">{usd(r.arrAtRisk)}</td>
                  <td className="px-4 py-3 text-right num text-ink-2">{r.daysToRenewal}d</td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <BandTag band={r.band} />
                      <FlagTag flag={r.flag} />
                    </span>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-3">No accounts match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Meter({ v, color }: { v: number; color: string }) {
  return (
    <span className="relative block h-1.5 w-14 rounded-full bg-line-soft overflow-hidden" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(4, v * 100)}%`, background: color }} />
    </span>
  );
}
