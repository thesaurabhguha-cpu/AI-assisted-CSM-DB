import type { Band, Flag } from "./types";

export const usd = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const signedPct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

export const BAND_META: Record<Band, { label: string; color: string; icon: string }> = {
  healthy: { label: "Healthy", color: "var(--moss)", icon: "●" },
  watch: { label: "Watch", color: "var(--ochre)", icon: "◆" },
  "at-risk": { label: "At risk", color: "var(--brick)", icon: "▲" },
};

export const FLAG_META: Record<Exclude<Flag, null>, { label: string; short: string; explain: string }> = {
  "silent-churn": {
    label: "Silent churn",
    short: "Looks healthy, model says leaving",
    explain: "The health score is green, but the churn model puts 12-month churn at 40% or higher.",
  },
  "loud-but-loyal": {
    label: "Loud but loyal",
    short: "Looks worse than it is",
    explain: "Support load drags the score down, but the churn model sees low risk of leaving.",
  },
};
