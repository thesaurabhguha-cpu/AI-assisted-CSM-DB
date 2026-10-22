import type { Assessment } from "../types";
import { formatUsd, type Metric } from "./metrics";
import type { Claim, Draft, Recommendation } from "./schema";

// Deterministic draft used when the live model is unavailable (no key, quota hit,
// malformed output). Built only from the metric registry, so it always verifies.

export function deterministicDraft(x: Assessment, metrics: Metric[], unknowns: { id: string; label: string }[]): Draft {
  const a = x.account;
  const get = (id: string) => metrics.find((m) => m.id === id);
  const d = (id: string) => get(id)?.display ?? "";
  const has = (id: string) => !!get(id);
  const c = (text: string, ...ids: string[]): Claim => ({ text, metricIds: ids.filter(has) });
  const util = Number(get("seat_util")?.value ?? 0);
  const trend = Number(get("usage_trend_90d")?.value ?? 0);
  const goals = metrics.filter((m) => m.id.startsWith("goal_"));
  const firstName = a.champion?.name.split(" ")[0] ?? "there";

  const exec: Claim[] = [
    c(`${a.name} is on the ${d("plan")} plan at ${d("arr")} ARR with ${d("seats_active")} of ${d("seats_purchased")} seats active (${d("seat_util")}) and renewal in ${d("days_to_renewal")}.`, "plan", "arr", "seats_active", "seats_purchased", "seat_util", "days_to_renewal"),
  ];
  if (x.flag === "silent-churn")
    exec.push(c(`Usage looks strong, but the champion changed in the last 90 days and no executive sponsor is engaged, so the relationship needs rebuilding before renewal.`, "champion_changed", "exec_sponsor", "dau_mau"));
  else if (trend <= -20)
    exec.push(c(`Weekly active users changed ${d("usage_trend_90d")} over 90 days, the clearest sign that the team is moving work elsewhere.`, "usage_trend_90d"));
  else if (Number(get("p1_90d")?.value ?? 0) >= 2)
    exec.push(c(`${d("p1_90d")} P1 incidents in 90 days and ${d("tickets_open")} open tickets are the main drag on the experience.`, "p1_90d", "tickets_open"));
  else if (util >= 95)
    exec.push(c(`The team is using ${d("seat_util")} of purchased seats, so growth is now limited by seat count rather than adoption.`, "seat_util"));
  else exec.push(c(`Adoption is steady at ${d("features_adopted")} core features with ${d("dau_mau")} daily stickiness.`, "features_adopted", "dau_mau"));

  const value: Claim[] = goals.length
    ? goals.slice(0, 2).map((g) => c(`Success-plan goal: "${g.display}". Progress against this goal is not measured in the data available, so it needs confirming with the customer.`, g.id))
    : [c("No success-plan goals are on record, so value delivered cannot be stated yet.", "plan")];

  const adoption: Claim[] = [
    c(`${d("features_adopted")} core features in use and ${d("dau_mau")} DAU/MAU.`, "features_adopted", "dau_mau"),
    c(`Weekly active users changed ${d("usage_trend_90d")} over the last 90 days.`, "usage_trend_90d"),
  ];

  const risks: Claim[] = [];
  if (x.flag === "silent-churn")
    risks.push(c(`Internal: the health score reads ${d("health_score")} (${d("health_band")}), yet the churn model puts 12-month churn at ${d("churn_probability")}, driven by ${d("driver_1")} and ${d("driver_2")}.`, "health_score", "health_band", "churn_probability", "driver_1", "driver_2"));
  else
    risks.push(c(`Internal: health score ${d("health_score")} and model churn probability ${d("churn_probability")}, top driver ${d("driver_1")}.`, "health_score", "churn_probability", "driver_1"));
  risks.push(c(`ARR at risk is ${d("arr_at_risk")} with renewal in ${d("days_to_renewal")}.`, "arr_at_risk", "days_to_renewal"));
  if (Number(get("late_payments_12m")?.value ?? 0) > 0)
    risks.push(c(`${d("late_payments_12m")} late payment(s) in the last 12 months.`, "late_payments_12m"));

  const recs: Recommendation[] = [];
  if (a.championChanged90d) recs.push({ action: "Meet the new champion and re-run the success plan", owner: "CSM", timeframe: "within 14 days", rationale: c("The champion changed in the last 90 days.", "champion_changed") });
  if (!a.execSponsorEngaged) recs.push({ action: "Secure an executive sponsor for the renewal conversation", owner: "Joint", timeframe: "within 30 days", rationale: c("No executive sponsor is engaged.", "exec_sponsor") });
  if (a.p1Tickets90d >= 2) recs.push({ action: "Run a support escalation review with engineering", owner: "CSM", timeframe: "within 14 days", rationale: c(`${d("p1_90d")} P1 tickets in 90 days.`, "p1_90d") });
  if (trend <= -20) recs.push({ action: "Interview team leads on why usage dropped", owner: "Joint", timeframe: "within 30 days", rationale: c(`Weekly active users changed ${d("usage_trend_90d")}.`, "usage_trend_90d") });
  if (util >= 95) recs.push({ action: "Propose a seat expansion sized to current demand", owner: "CSM", timeframe: "before renewal", rationale: c(`Seat utilization is ${d("seat_util")}.`, "seat_util") });
  if (recs.length < 2) recs.push({ action: "Agree two measurable goals for next quarter", owner: "Joint", timeframe: "within 30 days", rationale: c(`${d("features_adopted")} core features are in use today.`, "features_adopted") });

  const asks: Claim[] = [c("Confirm which success-plan goals still matter and how the team measures them.", ...(goals.length ? goals.map((g) => g.id) : ["plan"]))];

  const unk = unknowns.map((u) => ({ metric: u.label, why: WHY[u.id] ?? "Missing data weakens the score and should be collected." }));

  const opener = x.flag === "silent-churn"
    ? c(`I'd like to make sure your team keeps getting full value from ${d("plan")} as things change on your side.`, "plan", "champion_changed")
    : trend <= -20
      ? c(`I noticed weekly activity on your workspace has shifted over the last 90 days and wanted to check in before it affects your team's results.`, "usage_trend_90d")
      : a.p1Tickets90d >= 2
        ? c(`I know the recent incidents have been frustrating, and I want to make sure each one is fully resolved.`, "p1_90d")
        : c(`Your team is getting strong use out of the workspace, and I'd like to plan the next stage with you.`, "seat_util");
  const ask = c(`Could we set up a 30-minute review within the next two weeks to walk through your goals${goals.length ? `, starting with "${goals[0].display}"` : ""}, and agree next steps together?`, ...(goals.length ? [goals[0].id] : ["plan"]));

  return {
    qbr: {
      headline: x.flag === "silent-churn" ? `${a.name}: healthy usage, fragile relationship` : `${a.name}: ${x.health.band === "healthy" ? "on track" : x.health.band === "watch" ? "needs attention" : "at risk"} ahead of renewal`,
      executiveSummary: exec,
      valueDelivered: value,
      adoption,
      risks,
      recommendations: recs.slice(0, 4),
      asks,
      unknowns: unk,
    },
    email: {
      subject: x.flag === "silent-churn" ? `Getting set up for success, ${a.name}` : `Next steps for ${a.name}`,
      paragraphs: [c(`Hi ${firstName},`, "champion"), opener, ask],
    },
  };
}

const WHY: Record<string, string> = {
  nps: "Without a recent NPS response there is no direct read on advocacy before renewal.",
  csat: "Without CSAT, support quality is inferred only from ticket volume.",
  ticket_sentiment: "Without ticket sentiment, frustration in support conversations is invisible.",
  avg_resolution_hrs: "Resolution time shows whether support issues are being closed fast enough.",
  last_qbr_days_ago: "No QBR on record means outcomes have not been reviewed with the customer.",
  goals: "Without agreed goals, value delivered cannot be shown in business terms.",
};

export { formatUsd };
