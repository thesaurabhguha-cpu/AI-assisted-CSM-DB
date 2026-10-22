// Canonical account snapshot. Demo data and uploaded CSVs both map to this shape.
// Nullable fields are genuinely optional signals: when absent, the score
// re-weights and the AI layer must list them as unknowns instead of guessing.

export type Segment = "SMB" | "Mid-Market" | "Enterprise";

export interface AccountSnapshot {
  id: string;
  name: string;
  segment: Segment;
  industry: string;
  plan: string;
  arr: number; // USD
  tenureDays: number;
  daysToRenewal: number;
  seatsPurchased: number;
  seatsActive: number;
  dauMau: number; // 0..1 stickiness
  featuresAdopted: number; // 0..8 core features in use
  usageTrend90d: number; // fractional change in weekly active users, e.g. -0.32
  ticketsOpen: number;
  p1Tickets90d: number;
  ticketSentiment: number | null; // -1..1 from ticket text
  avgResolutionHrs: number | null;
  nps: number | null; // latest 0..10 response from the account
  csat: number | null; // 1..5
  latePayments12m: number;
  execSponsorEngaged: boolean;
  championChanged90d: boolean;
  lastQbrDaysAgo: number | null;
  champion?: { name: string; title: string } | null;
  goals?: string[];
}

export interface AccountSeries {
  weeklyActiveUsers: number[]; // 52 weeks, oldest first
  ticketsPerMonth: number[]; // 12 months, oldest first
  events: { weeksAgo: number; label: string }[];
}

export interface DemoAccount extends AccountSnapshot {
  archetype: Archetype;
  series: AccountSeries;
}

export type Archetype =
  | "silent-churner"
  | "usage-cliff"
  | "ticket-storm"
  | "loud-but-loyal"
  | "expansion-ready"
  | "steady"
  | "onboarding";

export type Band = "healthy" | "watch" | "at-risk";

export interface HealthComponent {
  key: string;
  label: string;
  weight: number; // effective weight after re-weighting, sums to 1
  score: number | null; // 0..100, null when no data
  contribution: number; // weight * score (points out of 100)
  note: string;
}

export interface HealthResult {
  score: number; // 0..100
  band: Band;
  lifecycle: "onboarding" | "established";
  components: HealthComponent[];
  missing: string[];
}

export interface ModelDriver {
  feature: string;
  label: string;
  value: string;
  logitContribution: number; // >0 raises churn risk
}

export interface ChurnResult {
  probability: number; // 0..1
  drivers: ModelDriver[]; // sorted by absolute impact
}

export type Flag = "silent-churn" | "loud-but-loyal" | null;

export interface Assessment {
  account: AccountSnapshot;
  health: HealthResult;
  churn: ChurnResult;
  flag: Flag;
  arrAtRisk: number; // arr * probability
}
