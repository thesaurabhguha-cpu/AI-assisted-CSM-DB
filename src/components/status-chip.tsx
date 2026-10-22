"use client";
import { useEffect, useState } from "react";

interface Status { liveAi: boolean; store: string; perVisitorDailyRuns: number }

export function StatusChip() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setS).catch(() => setS(null));
  }, []);
  const live = s?.liveAi;
  return (
    <span
      className="hidden sm:inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-2"
      title={live ? `Gemini drafts on, ${s?.perVisitorDailyRuns} live runs per visitor per day` : "No AI key configured: drafts use the deterministic engine"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s === null ? "bg-ink-3" : live ? "bg-moss" : "bg-ochre"}`} />
      {s === null ? "Checking AI" : live ? "Live AI on" : "Deterministic mode"}
    </span>
  );
}
