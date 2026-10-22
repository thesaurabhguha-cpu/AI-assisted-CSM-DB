import type { AccountSnapshot, Segment } from "../types";

// CSV contract for uploads. One row per account. Mock data only.

export interface Column {
  key: string;
  required: boolean;
  example: string;
  help: string;
}

export const COLUMNS: Column[] = [
  { key: "account_name", required: true, example: "Acme Robotics", help: "Company name (fictional)" },
  { key: "segment", required: false, example: "Mid-Market", help: "SMB, Mid-Market or Enterprise" },
  { key: "industry", required: false, example: "Manufacturing", help: "Free text" },
  { key: "arr", required: true, example: "84000", help: "Annual recurring revenue in USD" },
  { key: "seats_purchased", required: true, example: "200", help: "Licensed seats" },
  { key: "seats_active", required: true, example: "171", help: "Seats active in last 30 days" },
  { key: "dau_mau", required: true, example: "0.41", help: "0 to 1" },
  { key: "features_adopted", required: true, example: "6", help: "0 to 8 core features" },
  { key: "usage_trend_90d", required: true, example: "-0.12", help: "Fractional change in weekly actives, e.g. -0.12" },
  { key: "tickets_open", required: true, example: "2", help: "Open support tickets" },
  { key: "p1_tickets_90d", required: true, example: "0", help: "P1 tickets in 90 days" },
  { key: "ticket_sentiment", required: false, example: "0.15", help: "-1 to 1, blank if unknown" },
  { key: "avg_resolution_hrs", required: false, example: "18", help: "Hours, blank if unknown" },
  { key: "nps", required: false, example: "8", help: "0 to 10, blank if unknown" },
  { key: "csat", required: false, example: "4.2", help: "1 to 5, blank if unknown" },
  { key: "late_payments_12m", required: true, example: "0", help: "Count" },
  { key: "exec_sponsor_engaged", required: true, example: "yes", help: "yes or no" },
  { key: "champion_changed_90d", required: true, example: "no", help: "yes or no" },
  { key: "tenure_days", required: true, example: "540", help: "Days since contract start" },
  { key: "days_to_renewal", required: true, example: "120", help: "Days until renewal" },
  { key: "last_qbr_days_ago", required: false, example: "75", help: "Blank if never" },
];

const PII = /(e-?mail|phone|mobile|address|street|postcode|zip|ssn|social|passport|first_?name|last_?name|full_?name|contact_?name|dob|birth|iban|card)/i;

export function templateCsv(): string {
  const header = COLUMNS.map((c) => c.key).join(",");
  const rows = [
    ["Acme Robotics", "Mid-Market", "Manufacturing", "84000", "200", "171", "0.41", "6", "-0.12", "2", "0", "0.15", "18", "8", "4.2", "0", "yes", "no", "540", "120", "75"],
    ["Bluefin Data", "SMB", "Analytics", "21000", "50", "49", "0.52", "7", "0.18", "1", "0", "0.4", "12", "9", "4.6", "0", "yes", "no", "820", "60", "40"],
    ["Corvane Logistics", "Enterprise", "Logistics", "310000", "900", "790", "0.47", "6", "-0.02", "1", "0", "-0.1", "", "", "3.9", "1", "no", "yes", "980", "75", ""],
  ];
  return [header, ...rows.map((r) => r.join(","))].join("\n") + "\n";
}

const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Number(v.trim()));
const bool = (v: string | undefined) => /^(y|yes|true|1)$/i.test((v ?? "").trim());
const clean = (v: string | undefined, max = 60) => (v ?? "").replace(/[^\p{L}\p{N} &.,'()-]/gu, "").trim().slice(0, max);

export interface ParseResult {
  accounts: AccountSnapshot[];
  errors: string[];
  blocked: string | null;
}

export function rowsToSnapshots(rows: Record<string, string>[], headers: string[]): ParseResult {
  const pii = headers.filter((h) => PII.test(h));
  if (pii.length) return { accounts: [], errors: [], blocked: `Remove personal-data columns before uploading: ${pii.join(", ")}. This demo only accepts mock account metrics.` };
  const missing = COLUMNS.filter((c) => c.required && !headers.includes(c.key)).map((c) => c.key);
  if (missing.length) return { accounts: [], errors: [], blocked: `Missing required columns: ${missing.join(", ")}. Download the template to see the format.` };
  if (rows.length > 100) return { accounts: [], errors: [], blocked: "Upload up to 100 accounts at a time." };

  const accounts: AccountSnapshot[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const snap = toSnapshot(r, `upload-${i + 1}`);
    if (typeof snap === "string") errors.push(`Row ${line}: ${snap}`);
    else accounts.push(snap);
  });
  return { accounts, errors, blocked: null };
}

function toSnapshot(r: Record<string, string>, id: string): AccountSnapshot | string {
  const name = clean(r.account_name);
  if (!name) return "account_name is empty";
  const seg = clean(r.segment) as Segment;
  const s: AccountSnapshot = {
    id,
    name,
    segment: (["SMB", "Mid-Market", "Enterprise"] as const).includes(seg) ? seg : "Mid-Market",
    industry: clean(r.industry, 40),
    plan: "Uploaded",
    arr: num(r.arr) ?? NaN,
    tenureDays: num(r.tenure_days) ?? NaN,
    daysToRenewal: num(r.days_to_renewal) ?? NaN,
    seatsPurchased: num(r.seats_purchased) ?? NaN,
    seatsActive: num(r.seats_active) ?? NaN,
    dauMau: num(r.dau_mau) ?? NaN,
    featuresAdopted: num(r.features_adopted) ?? NaN,
    usageTrend90d: num(r.usage_trend_90d) ?? NaN,
    ticketsOpen: num(r.tickets_open) ?? NaN,
    p1Tickets90d: num(r.p1_tickets_90d) ?? NaN,
    ticketSentiment: num(r.ticket_sentiment),
    avgResolutionHrs: num(r.avg_resolution_hrs),
    nps: num(r.nps),
    csat: num(r.csat),
    latePayments12m: num(r.late_payments_12m) ?? NaN,
    execSponsorEngaged: bool(r.exec_sponsor_engaged),
    championChanged90d: bool(r.champion_changed_90d),
    lastQbrDaysAgo: num(r.last_qbr_days_ago),
    champion: null,
    goals: [],
  };
  const err = validateSnapshot(s);
  return err ?? s;
}

// Shared bounds check, used client-side on upload and server-side on every API call.
export function validateSnapshot(s: AccountSnapshot): string | null {
  const range = (v: number | null, lo: number, hi: number, label: string, optional = false) => {
    if (v === null) return optional ? null : `${label} is required`;
    if (!Number.isFinite(v)) return `${label} must be a number`;
    if (v < lo || v > hi) return `${label} must be between ${lo} and ${hi}`;
    return null;
  };
  return (
    range(s.arr, 0, 50_000_000, "arr") ??
    range(s.seatsPurchased, 1, 200_000, "seats_purchased") ??
    range(s.seatsActive, 0, s.seatsPurchased, "seats_active") ??
    range(s.dauMau, 0, 1, "dau_mau") ??
    range(s.featuresAdopted, 0, 8, "features_adopted") ??
    range(s.usageTrend90d, -1, 5, "usage_trend_90d") ??
    range(s.ticketsOpen, 0, 10_000, "tickets_open") ??
    range(s.p1Tickets90d, 0, 1000, "p1_tickets_90d") ??
    range(s.ticketSentiment, -1, 1, "ticket_sentiment", true) ??
    range(s.avgResolutionHrs, 0, 10_000, "avg_resolution_hrs", true) ??
    range(s.nps, 0, 10, "nps", true) ??
    range(s.csat, 1, 5, "csat", true) ??
    range(s.latePayments12m, 0, 100, "late_payments_12m") ??
    range(s.tenureDays, 0, 20_000, "tenure_days") ??
    range(s.daysToRenewal, 0, 2_000, "days_to_renewal") ??
    range(s.lastQbrDaysAgo, 0, 20_000, "last_qbr_days_ago", true)
  );
}

export function sanitizeSnapshot(input: unknown): AccountSnapshot | string {
  if (!input || typeof input !== "object") return "Account payload is missing";
  const r = input as Record<string, unknown>;
  const n = (k: string) => (r[k] === null || r[k] === undefined ? null : Number(r[k]));
  const s: AccountSnapshot = {
    id: clean(String(r.id ?? "upload"), 40) || "upload",
    name: clean(String(r.name ?? "")) || "Uploaded account",
    segment: (["SMB", "Mid-Market", "Enterprise"] as const).includes(r.segment as Segment) ? (r.segment as Segment) : "Mid-Market",
    industry: clean(String(r.industry ?? ""), 40),
    plan: "Uploaded",
    arr: n("arr") ?? NaN,
    tenureDays: n("tenureDays") ?? NaN,
    daysToRenewal: n("daysToRenewal") ?? NaN,
    seatsPurchased: n("seatsPurchased") ?? NaN,
    seatsActive: n("seatsActive") ?? NaN,
    dauMau: n("dauMau") ?? NaN,
    featuresAdopted: n("featuresAdopted") ?? NaN,
    usageTrend90d: n("usageTrend90d") ?? NaN,
    ticketsOpen: n("ticketsOpen") ?? NaN,
    p1Tickets90d: n("p1Tickets90d") ?? NaN,
    ticketSentiment: n("ticketSentiment"),
    avgResolutionHrs: n("avgResolutionHrs"),
    nps: n("nps"),
    csat: n("csat"),
    latePayments12m: n("latePayments12m") ?? NaN,
    execSponsorEngaged: r.execSponsorEngaged === true,
    championChanged90d: r.championChanged90d === true,
    lastQbrDaysAgo: n("lastQbrDaysAgo"),
    champion: null,
    goals: [],
  };
  return validateSnapshot(s) ?? s;
}
