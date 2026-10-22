import type { AccountSnapshot, Assessment, Flag } from "../types";
import { computeHealth } from "./health";
import { predictChurn } from "./model";

export const SILENT_CHURN_PROB = 0.4;
export const LOUD_LOYAL_PROB = 0.25;

export function assess(account: AccountSnapshot): Assessment {
  const health = computeHealth(account);
  const churn = predictChurn(account);
  let flag: Flag = null;
  // The headline insight: the score says fine, the model says leaving.
  if (health.band === "healthy" && churn.probability >= SILENT_CHURN_PROB) flag = "silent-churn";
  // The inverse: the score panics, the model says they're staying.
  else if (health.band !== "healthy" && health.lifecycle === "established" && churn.probability < LOUD_LOYAL_PROB) flag = "loud-but-loyal";
  return { account, health, churn, flag, arrAtRisk: account.arr * churn.probability };
}

export function assessAll(accounts: AccountSnapshot[]): Assessment[] {
  return accounts.map(assess);
}

export function portfolioStats(rows: Assessment[]) {
  const arr = rows.reduce((s, r) => s + r.account.arr, 0);
  const arrAtRisk = rows.reduce((s, r) => s + r.arrAtRisk, 0);
  const renewals90 = rows.filter((r) => r.account.daysToRenewal <= 90);
  const avgHealth = rows.length ? Math.round(rows.reduce((s, r) => s + r.health.score, 0) / rows.length) : 0;
  return {
    accounts: rows.length,
    arr,
    arrAtRisk,
    avgHealth,
    renewals90: renewals90.length,
    renewals90Arr: renewals90.reduce((s, r) => s + r.account.arr, 0),
    silentChurn: rows.filter((r) => r.flag === "silent-churn"),
    loudLoyal: rows.filter((r) => r.flag === "loud-but-loyal"),
    atRisk: rows.filter((r) => r.health.band === "at-risk").length,
    watch: rows.filter((r) => r.health.band === "watch").length,
    healthy: rows.filter((r) => r.health.band === "healthy").length,
  };
}
