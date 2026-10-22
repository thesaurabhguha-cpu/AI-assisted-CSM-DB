import type { Assessment } from "../types";

// Every number the AI is allowed to state comes from this registry.
// The prompt lists these by ID; the verifier checks drafted numbers against them.

export type Unit = "usd" | "pct" | "count" | "days" | "hours" | "score10" | "score5" | "index" | "bool" | "text";

export interface Metric {
  id: string;
  label: string;
  unit: Unit;
  value: number | string | boolean;
  display: string;
}

const usd = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`;

export function formatUsd(v: number) {
  return usd(v);
}

export function buildMetrics(x: Assessment): { metrics: Metric[]; unknowns: { id: string; label: string }[] } {
  const a = x.account;
  const util = a.seatsPurchased ? a.seatsActive / a.seatsPurchased : 0;
  const m: Metric[] = [];
  const unknowns: { id: string; label: string }[] = [];
  const add = (id: string, label: string, unit: Unit, value: Metric["value"], display: string) => m.push({ id, label, unit, value, display });
  const opt = (id: string, label: string, unit: Unit, value: number | null, display: (v: number) => string) =>
    value === null ? unknowns.push({ id, label }) : add(id, label, unit, value, display(value));

  add("arr", "Annual recurring revenue", "usd", a.arr, usd(a.arr));
  add("plan", "Plan", "text", a.plan, a.plan);
  add("segment", "Segment", "text", a.segment, a.segment);
  add("tenure_days", "Customer tenure", "days", a.tenureDays, `${a.tenureDays} days`);
  add("days_to_renewal", "Days to renewal", "days", a.daysToRenewal, `${a.daysToRenewal} days`);
  add("seats_purchased", "Seats purchased", "count", a.seatsPurchased, String(a.seatsPurchased));
  add("seats_active", "Seats active", "count", a.seatsActive, String(a.seatsActive));
  add("seat_util", "Seat utilization", "pct", Math.round(util * 100), `${Math.round(util * 100)}%`);
  add("dau_mau", "DAU/MAU stickiness", "pct", Math.round(a.dauMau * 100), `${Math.round(a.dauMau * 100)}%`);
  add("features_adopted", "Core features adopted (of 8)", "count", a.featuresAdopted, `${a.featuresAdopted} of 8`);
  const tr = Math.round(a.usageTrend90d * 100);
  add("usage_trend_90d", "Weekly active users, 90-day change", "pct", tr, `${tr > 0 ? "+" : ""}${tr}%`);
  add("tickets_open", "Open support tickets", "count", a.ticketsOpen, String(a.ticketsOpen));
  add("p1_90d", "P1 tickets in last 90 days", "count", a.p1Tickets90d, String(a.p1Tickets90d));
  opt("ticket_sentiment", "Ticket sentiment (-1 to 1)", "index", a.ticketSentiment, (v) => v.toFixed(2));
  opt("avg_resolution_hrs", "Average ticket resolution time", "hours", a.avgResolutionHrs, (v) => `${v} hours`);
  opt("nps", "Latest NPS response (0-10)", "score10", a.nps, (v) => `${v}/10`);
  opt("csat", "CSAT (1-5)", "score5", a.csat, (v) => `${v.toFixed(1)}/5`);
  add("late_payments_12m", "Late payments in 12 months", "count", a.latePayments12m, String(a.latePayments12m));
  add("exec_sponsor", "Executive sponsor engaged", "bool", a.execSponsorEngaged, a.execSponsorEngaged ? "yes" : "no");
  add("champion_changed", "Champion changed in last 90 days", "bool", a.championChanged90d, a.championChanged90d ? "yes" : "no");
  opt("last_qbr_days_ago", "Days since last QBR", "days", a.lastQbrDaysAgo, (v) => `${v} days`);
  add("health_score", "Health score (0-100)", "count", x.health.score, `${x.health.score}/100`);
  add("health_band", "Health band", "text", x.health.band, x.health.band);
  add("churn_probability", "Model churn probability (12 months)", "pct", Math.round(x.churn.probability * 100), `${Math.round(x.churn.probability * 100)}%`);
  add("arr_at_risk", "ARR at risk (ARR x churn probability)", "usd", Math.round(x.arrAtRisk), usd(x.arrAtRisk));
  for (const c of x.health.components) {
    if (c.score !== null) add(`component_${c.key}`, `Health component: ${c.label} (0-100)`, "count", Math.round(c.score), `${Math.round(c.score)}/100`);
  }
  x.churn.drivers.slice(0, 4).forEach((d, i) =>
    add(`driver_${i + 1}`, `Model driver #${i + 1}: ${d.label} ${d.logitContribution > 0 ? "raises" : "lowers"} risk`, "text", d.value, `${d.label} = ${d.value}`),
  );
  (a.goals ?? []).forEach((g, i) => add(`goal_${i + 1}`, "Customer success-plan goal", "text", g, g));
  if (!a.goals?.length) unknowns.push({ id: "goals", label: "Customer success-plan goals" });
  if (a.champion) add("champion", "Champion", "text", `${a.champion.name}, ${a.champion.title}`, `${a.champion.name}, ${a.champion.title}`);
  return { metrics: m, unknowns };
}
