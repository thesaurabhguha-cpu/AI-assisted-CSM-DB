import type { Metric } from "./metrics";
import type { Claim, Draft } from "./schema";

// Deterministic fact-checker. Every number in a drafted claim must match a
// metric the claim cites. Numbers that are structural (time windows, "of 8",
// quarters, years) are allowed. Anything else is flagged, never silently kept.

export type ClaimStatus = "verified" | "qualitative" | "unverified";

export interface CheckedNumber {
  raw: string;
  value: number;
  matched: string | null; // metric id
  structural: boolean;
}

export interface ClaimCheck {
  path: string;
  text: string;
  status: ClaimStatus;
  numbers: CheckedNumber[];
  badIds: string[];
  reasons: string[];
}

export const INTERNAL_METRICS = new Set(["health_score", "health_band", "churn_probability", "arr_at_risk"]);
const isInternal = (id: string) => INTERNAL_METRICS.has(id) || id.startsWith("driver_") || id.startsWith("component_");

export interface Verification {
  checks: ClaimCheck[];
  factsTotal: number;
  factsVerified: number;
  claimsUnverified: number;
  passed: boolean;
}

const NUM_RE = /(\$)?(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)\s*(k|K|M|m(?![a-z])|%|\/\s?(?:10|5|8|100)\b)?/g;

function parseNumbers(text: string) {
  const out: { raw: string; value: number; kind: "usd" | "pct" | "plain"; structural: boolean }[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const [raw, dollar, numStr, suffix] = m;
    const idx = m.index ?? 0;
    if (idx > 0 && /[A-Za-z]/.test(text[idx - 1])) continue; // P1, Q3, H2
    const before = text.slice(Math.max(0, idx - 3), idx);
    const after = text.slice(idx + raw.length, idx + raw.length + 12).toLowerCase();
    let value = parseFloat(numStr.replace(/,/g, ""));
    const sfx = suffix?.replace(/\s/g, "");
    if (sfx === "k" || sfx === "K") value *= 1000;
    if (sfx === "M" || sfx === "m") value *= 1_000_000;
    const kind = dollar ? "usd" : sfx === "%" ? "pct" : "plain";
    const year = !dollar && value >= 2020 && value <= 2035 && Number.isInteger(value);
    const quarter = /q$/i.test(before.trim().slice(-1));
    const windowDays = !dollar && [7, 14, 30, 60, 90].includes(value) && /^\s*(-|–)?\s*days?\b/.test(after) && /(next|last|past|coming|within|in|over|the|first|every)\s*$/i.test(text.slice(Math.max(0, idx - 10), idx));
    const hyphenWindow = !dollar && /^-(day|week|month|year)\b/.test(after) && [7, 14, 30, 45, 60, 90, 120, 180, 365, 3, 6, 12].includes(value);
    const months = !dollar && /^\s*(-)?\s*months?\b/.test(after) && [3, 6, 12].includes(value);
    const ofDenominator = /\bof\s*$/i.test(text.slice(Math.max(0, idx - 4), idx)) && [5, 8, 10, 100].includes(value);
    const afterSlash = /\/\s*$/.test(before) && [5, 8, 10, 100].includes(value);
    const ordinal = /^(st|nd|rd|th)\b/.test(after);
    const wordy = /^\s*-?\s*(minutes?|min|weeks?|business days?|calls?|sessions?|steps?)\b/.test(after) && value <= 90 && !dollar;
    out.push({ raw: raw.trim(), value, kind, structural: year || quarter || windowDays || months || ofDenominator || afterSlash || ordinal || wordy || hyphenWindow });
  }
  return out;
}

function matches(n: { value: number; kind: string }, metric: Metric): boolean {
  if (typeof metric.value !== "number") return false;
  const v = metric.value;
  const x = Math.abs(n.value);
  const target = Math.abs(v);
  if (metric.unit === "usd") {
    if (n.kind === "pct") return false;
    return Math.abs(x - target) <= Math.max(target * 0.02, 600);
  }
  if (metric.unit === "pct") {
    if (n.kind === "usd") return false;
    return Math.abs(x - target) <= 1;
  }
  if (metric.unit === "index") return Math.abs(x - target) <= 0.011 || Math.abs(x - Math.abs(target) * 100) <= 1;
  if (n.kind === "usd" || n.kind === "pct") return false;
  if (metric.unit === "score5") return Math.abs(x - target) <= 0.051;
  return Math.abs(x - target) <= 0.5;
}

export function checkClaim(claim: Claim, path: string, metrics: Metric[]): ClaimCheck {
  const byId = new Map(metrics.map((m) => [m.id, m]));
  const badIds = claim.metricIds.filter((id) => !byId.has(id));
  const cited = claim.metricIds.map((id) => byId.get(id)).filter((m): m is Metric => !!m);
  // Quoted text metrics (goals, driver labels) may contain numbers of their own.
  let scrubbed = claim.text;
  for (const m of cited) if (m.unit === "text" && m.display.length > 3) scrubbed = scrubbed.split(m.display).join(" ");
  const numbers: CheckedNumber[] = parseNumbers(scrubbed).map((n) => {
    const hit = cited.find((m) => matches(n, m));
    return { raw: n.raw, value: n.value, matched: hit?.id ?? null, structural: !hit && n.structural };
  });
  const factual = numbers.filter((n) => !n.structural);
  const reasons: string[] = [];
  if (badIds.length) reasons.push(`Cites unknown metric ${badIds.join(", ")}`);
  for (const n of factual) if (!n.matched) reasons.push(`${n.raw} does not match any cited metric`);
  if (!cited.length && !factual.length) reasons.push("No metric cited");
  if (path.startsWith("email.") && claim.metricIds.some(isInternal)) reasons.push("Email cites an internal-only metric");
  else if (path.startsWith("qbr.") && !path.startsWith("qbr.risks") && claim.metricIds.some(isInternal))
    reasons.push("Internal-only metric outside the internal risk notes");
  let status: ClaimStatus;
  if (reasons.length) status = "unverified";
  else if (factual.length === 0) status = "qualitative";
  else status = "verified";
  return { path, text: claim.text, status, numbers, badIds, reasons };
}

export function verifyDraft(draft: Draft, metrics: Metric[]): Verification {
  const checks: ClaimCheck[] = [];
  const q = draft.qbr;
  const sections: [string, Claim[]][] = [
    ["qbr.executiveSummary", q.executiveSummary],
    ["qbr.valueDelivered", q.valueDelivered],
    ["qbr.adoption", q.adoption],
    ["qbr.risks", q.risks],
    ["qbr.asks", q.asks],
    ["email.paragraphs", draft.email.paragraphs],
  ];
  for (const [p, list] of sections) list.forEach((c, i) => checks.push(checkClaim(c, `${p}[${i}]`, metrics)));
  q.recommendations.forEach((r, i) => checks.push(checkClaim(r.rationale, `qbr.recommendations[${i}]`, metrics)));
  // Headline and subject carry no citations; any number in them must exist somewhere in the registry.
  for (const [p, text] of [["qbr.headline", q.headline], ["email.subject", draft.email.subject]] as const) {
    const pool = metrics.filter((m) => !isInternal(m.id));
    checks.push(checkClaim({ text, metricIds: pool.map((m) => m.id) }, p, metrics));
  }
  const facts = checks.flatMap((c) => c.numbers.filter((n) => !n.structural));
  const factsVerified = facts.filter((n) => n.matched).length;
  const claimsUnverified = checks.filter((c) => c.status === "unverified").length;
  return { checks, factsTotal: facts.length, factsVerified, claimsUnverified, passed: claimsUnverified === 0 };
}
