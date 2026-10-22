import type { AccountSnapshot } from "../types";
import { seatUtilization } from "./health";

// Model features. Missing optional signals are imputed with the training mean
// (z = 0) so the model degrades gracefully on sparse CSV uploads.

export interface FeatureDef {
  key: string;
  label: string;
  get: (a: AccountSnapshot) => number | null;
  fmt: (a: AccountSnapshot) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const FEATURES: FeatureDef[] = [
  { key: "seatUtil", label: "Seat utilization", get: (a) => seatUtilization(a), fmt: (a) => pct(seatUtilization(a)) },
  { key: "dauMau", label: "DAU/MAU", get: (a) => a.dauMau, fmt: (a) => pct(a.dauMau) },
  { key: "adoption", label: "Features adopted", get: (a) => a.featuresAdopted, fmt: (a) => `${a.featuresAdopted}/8` },
  { key: "usageTrend", label: "90-day usage trend", get: (a) => a.usageTrend90d, fmt: (a) => `${a.usageTrend90d > 0 ? "+" : ""}${pct(a.usageTrend90d)}` },
  { key: "ticketsOpen", label: "Open tickets", get: (a) => a.ticketsOpen, fmt: (a) => String(a.ticketsOpen) },
  { key: "p1", label: "P1 tickets (90d)", get: (a) => a.p1Tickets90d, fmt: (a) => String(a.p1Tickets90d) },
  { key: "sentiment", label: "Ticket sentiment", get: (a) => a.ticketSentiment, fmt: (a) => (a.ticketSentiment === null ? "unknown" : a.ticketSentiment.toFixed(2)) },
  { key: "nps", label: "NPS response", get: (a) => a.nps, fmt: (a) => (a.nps === null ? "unknown" : `${a.nps}/10`) },
  { key: "latePayments", label: "Late payments (12m)", get: (a) => a.latePayments12m, fmt: (a) => String(a.latePayments12m) },
  { key: "exec", label: "Exec sponsor engaged", get: (a) => (a.execSponsorEngaged ? 1 : 0), fmt: (a) => (a.execSponsorEngaged ? "yes" : "no") },
  { key: "champion", label: "Champion changed (90d)", get: (a) => (a.championChanged90d ? 1 : 0), fmt: (a) => (a.championChanged90d ? "yes" : "no") },
  { key: "tenure", label: "Tenure (log days)", get: (a) => Math.log1p(a.tenureDays), fmt: (a) => `${a.tenureDays} days` },
];
