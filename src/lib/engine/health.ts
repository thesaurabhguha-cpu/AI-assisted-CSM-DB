import type { AccountSnapshot, Band, HealthComponent, HealthResult } from "../types";

// Weighted, explainable health score. Weights follow the common industry split
// (usage-led, then support/sentiment, relationship, commercial) and shift during
// onboarding, when adoption matters more than momentum.
// The score is deliberately transparent: every point is attributable to a component.

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const BASE_WEIGHTS = {
  usage: 0.3,
  adoption: 0.15,
  momentum: 0.1,
  support: 0.15,
  voice: 0.15,
  relationship: 0.1,
  commercial: 0.05,
};

const ONBOARDING_WEIGHTS = {
  usage: 0.25,
  adoption: 0.25,
  momentum: 0.05,
  support: 0.15,
  voice: 0.1,
  relationship: 0.15,
  commercial: 0.05,
};

export const ONBOARDING_DAYS = 120;

export function bandFor(score: number): Band {
  if (score >= 70) return "healthy";
  if (score >= 50) return "watch";
  return "at-risk";
}

export function seatUtilization(a: AccountSnapshot): number {
  return a.seatsPurchased > 0 ? a.seatsActive / a.seatsPurchased : 0;
}

export function computeHealth(a: AccountSnapshot): HealthResult {
  const lifecycle = a.tenureDays < ONBOARDING_DAYS ? "onboarding" : "established";
  const w = lifecycle === "onboarding" ? ONBOARDING_WEIGHTS : BASE_WEIGHTS;
  const util = seatUtilization(a);
  const missing: string[] = [];

  const usage = clamp(0.5 * (util / 0.85) * 100 + 0.5 * (a.dauMau / 0.5) * 100);
  const adoption = clamp((a.featuresAdopted / 8) * 100);
  // -40% → 0, +20% → 100
  const momentum = clamp(((a.usageTrend90d + 0.4) / 0.6) * 100);

  let support = 100 - 10 * a.ticketsOpen - 18 * a.p1Tickets90d;
  if (a.avgResolutionHrs !== null) support -= clamp((a.avgResolutionHrs - 24) / 2, 0, 20);
  else missing.push("avgResolutionHrs");
  support = clamp(support);

  const voiceParts: number[] = [];
  if (a.nps !== null) voiceParts.push(a.nps * 10);
  else missing.push("nps");
  if (a.csat !== null) voiceParts.push(((a.csat - 1) / 4) * 100);
  else missing.push("csat");
  if (a.ticketSentiment !== null) voiceParts.push(((a.ticketSentiment + 1) / 2) * 100);
  else missing.push("ticketSentiment");
  const voice = voiceParts.length ? clamp(voiceParts.reduce((s, v) => s + v, 0) / voiceParts.length) : null;

  // A champion change is a known churn precursor, but most rules-based scores
  // under-weight it. We keep that realistic bias here; the churn model catches it.
  const relationship = (a.execSponsorEngaged ? 60 : 0) + (a.championChanged90d ? 0 : 40);
  const commercial = [100, 60, 30][a.latePayments12m] ?? 0;

  if (a.lastQbrDaysAgo === null) missing.push("lastQbrDaysAgo");

  const raw: Omit<HealthComponent, "weight" | "contribution">[] = [
    { key: "usage", label: "Usage depth", score: usage, note: `${Math.round(util * 100)}% seats active, ${Math.round(a.dauMau * 100)}% DAU/MAU` },
    { key: "adoption", label: "Feature adoption", score: adoption, note: `${a.featuresAdopted} of 8 core features` },
    { key: "momentum", label: "Usage momentum", score: momentum, note: `${fmtPct(a.usageTrend90d)} weekly actives over 90 days` },
    { key: "support", label: "Support load", score: support, note: `${a.ticketsOpen} open, ${a.p1Tickets90d} P1 in 90 days` },
    { key: "voice", label: "Voice of customer", score: voice, note: voice === null ? "No survey or ticket sentiment on record" : voiceNote(a) },
    { key: "relationship", label: "Relationship", score: relationship, note: `${a.execSponsorEngaged ? "Exec sponsor engaged" : "No exec sponsor"}, ${a.championChanged90d ? "champion changed" : "champion stable"}` },
    { key: "commercial", label: "Commercial", score: commercial, note: `${a.latePayments12m} late payment${a.latePayments12m === 1 ? "" : "s"} in 12 months` },
  ];

  // Re-weight across components that have data.
  const available = raw.filter((c) => c.score !== null);
  const totalW = available.reduce((s, c) => s + w[c.key as keyof typeof w], 0);
  const components: HealthComponent[] = raw.map((c) => {
    const weight = c.score === null ? 0 : w[c.key as keyof typeof w] / totalW;
    return { ...c, weight, contribution: c.score === null ? 0 : weight * c.score };
  });
  const score = Math.round(components.reduce((s, c) => s + c.contribution, 0));
  return { score, band: bandFor(score), lifecycle, components, missing };
}

function voiceNote(a: AccountSnapshot) {
  const parts: string[] = [];
  if (a.nps !== null) parts.push(`NPS ${a.nps}/10`);
  if (a.csat !== null) parts.push(`CSAT ${a.csat.toFixed(1)}/5`);
  if (a.ticketSentiment !== null) parts.push(`ticket sentiment ${a.ticketSentiment >= 0 ? "+" : ""}${a.ticketSentiment.toFixed(2)}`);
  return parts.join(", ");
}

export function fmtPct(v: number) {
  const p = Math.round(v * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}
