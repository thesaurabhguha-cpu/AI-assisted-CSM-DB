import { describe, expect, it } from "vitest";
import { getBook } from "../src/lib/data/generate";
import { assess } from "../src/lib/engine/assess";
import { buildMetrics } from "../src/lib/ai/metrics";
import { deterministicDraft } from "../src/lib/ai/fallback";
import { checkClaim, verifyDraft } from "../src/lib/ai/verify";
import { buildUserPrompt } from "../src/lib/ai/prompt";

describe("fact verifier", () => {
  const x = assess(getBook()[0]);
  const { metrics, unknowns } = buildMetrics(x);
  const m = (id: string) => metrics.find((q) => q.id === id)!;

  it("accepts numbers that match cited metrics", () => {
    const r = checkClaim({ text: `ARR is ${m("arr").display} with ${m("seat_util").display} of seats active.`, metricIds: ["arr", "seat_util"] }, "t", metrics);
    expect(r.status).toBe("verified");
  });
  it("rejects a number that is not in any cited metric", () => {
    const r = checkClaim({ text: "Seat utilization is 12%.", metricIds: ["seat_util"] }, "t", metrics);
    expect(r.status).toBe("unverified");
  });
  it("rejects a correct number when the metric is not cited", () => {
    const r = checkClaim({ text: `ARR is ${m("arr").display}.`, metricIds: ["seat_util"] }, "t", metrics);
    expect(r.status).toBe("unverified");
  });
  it("accepts numbers found inside a cited driver or goal", () => {
    const d = metrics.find((q) => q.id === "goal_1")!;
    const n = d.display.match(/\d+/)?.[0];
    if (n) expect(checkClaim({ text: `The goal targets ${n}% less time.`, metricIds: ["goal_1"] }, "t", metrics).status).toBe("verified");
  });
  it("rejects unknown metric ids", () => {
    const r = checkClaim({ text: "Strong quarter.", metricIds: ["made_up"] }, "t", metrics);
    expect(r.status).toBe("unverified");
  });
  it("treats time windows, quarters and denominators as structural", () => {
    const r = checkClaim({ text: `${m("features_adopted").value} of 8 features in use; review within 30 days in Q1, P1 count ${m("p1_90d").value}.`, metricIds: ["features_adopted", "p1_90d"] }, "t", metrics);
    expect(r.status).toBe("verified");
  });
  it("flags internal metrics in the customer email", () => {
    const r = checkClaim({ text: `Churn risk is ${m("churn_probability").display}.`, metricIds: ["churn_probability"] }, "email.paragraphs[0]", metrics);
    expect(r.status).toBe("unverified");
  });
  it("deterministic drafts verify for every demo account", () => {
    for (const a of getBook()) {
      const xa = assess(a);
      const b = buildMetrics(xa);
      const v = verifyDraft(deterministicDraft(xa, b.metrics, b.unknowns), b.metrics);
      if (!v.passed) console.log(a.name, v.checks.filter((c) => c.status === "unverified"));
      expect(v.passed).toBe(true);
    }
  });
  it("prompt lists unavailable data and marks it untrusted", () => {
    const p = buildUserPrompt(x, metrics, unknowns);
    expect(p).toContain("UNAVAILABLE");
    expect(p).toContain("untrusted");
  });
});

describe("verifier scope rules", () => {
  const x = assess(getBook()[0]);
  const { metrics } = buildMetrics(x);
  it("treats hyphenated windows as structural", () => {
    const r = checkClaim({ text: "Weekly active users show a 90-day change of +1%.", metricIds: ["usage_trend_90d"] }, "qbr.adoption[0]", metrics);
    expect(r.status).toBe("verified");
  });
  it("flags internal metrics outside the risk notes", () => {
    const hs = metrics.find((m) => m.id === "health_score")!;
    expect(checkClaim({ text: `Health score is ${hs.display}.`, metricIds: ["health_score"] }, "qbr.executiveSummary[0]", metrics).status).toBe("unverified");
    expect(checkClaim({ text: `Health score is ${hs.display}.`, metricIds: ["health_score"] }, "qbr.risks[0]", metrics).status).toBe("verified");
  });
});
