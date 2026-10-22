import { describe, expect, it } from "vitest";
import { getBook, generateHistory } from "../src/lib/data/generate";
import { assess, portfolioStats } from "../src/lib/engine/assess";
import { computeHealth } from "../src/lib/engine/health";
import { auc, MODEL } from "../src/lib/engine/model";

describe("health score", () => {
  it("is bounded and components sum to the score", () => {
    for (const a of getBook()) {
      const h = computeHealth(a);
      expect(h.score).toBeGreaterThanOrEqual(0);
      expect(h.score).toBeLessThanOrEqual(100);
      const sum = h.components.reduce((s, c) => s + c.contribution, 0);
      expect(Math.abs(sum - h.score)).toBeLessThanOrEqual(0.5);
      const w = h.components.reduce((s, c) => s + c.weight, 0);
      expect(w).toBeCloseTo(1, 6);
    }
  });
  it("re-weights when voice-of-customer data is missing", () => {
    const a = { ...getBook()[0], nps: null, csat: null, ticketSentiment: null };
    const h = computeHealth(a);
    expect(h.components.find((c) => c.key === "voice")!.weight).toBe(0);
    expect(h.missing).toEqual(expect.arrayContaining(["nps", "csat", "ticketSentiment"]));
  });
});

describe("churn model", () => {
  it("beats the rules-based score on held-out data (as trained)", () => {
    expect(MODEL.metrics.aucModel).toBeGreaterThan(MODEL.metrics.aucHealthScore);
    expect(MODEL.metrics.aucModel).toBeGreaterThan(0.8);
  });
  it("champion change raises churn risk", () => {
    const i = MODEL.features.indexOf("champion");
    expect(MODEL.coef[i]).toBeGreaterThan(0);
  });
  it("auc helper is correct on a toy case", () => {
    expect(auc([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1])).toBeCloseTo(0.75, 6);
  });
  it("history generator is reproducible", () => {
    expect(generateHistory(20, 3)).toEqual(generateHistory(20, 3));
  });
});

describe("demo book story", () => {
  const rows = getBook().map(assess);
  it("has 30 accounts with unique ids", () => {
    expect(new Set(rows.map((r) => r.account.id)).size).toBe(30);
  });
  it("every planted silent churner is flagged", () => {
    const sc = getBook().filter((a) => a.archetype === "silent-churner");
    for (const a of sc) expect(assess(a).flag).toBe("silent-churn");
  });
  it("loud-but-loyal accounts look worse than the model thinks", () => {
    for (const a of getBook().filter((x) => x.archetype === "loud-but-loyal")) {
      const r = assess(a);
      expect(r.health.band).not.toBe("healthy");
      expect(r.churn.probability).toBeLessThan(0.25);
    }
  });
  it("portfolio stats are consistent", () => {
    const s = portfolioStats(rows);
    expect(s.healthy + s.watch + s.atRisk).toBe(30);
    expect(s.arrAtRisk).toBeLessThan(s.arr);
  });
});
