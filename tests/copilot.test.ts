import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBook } from "../src/lib/data/generate";
import { assess } from "../src/lib/engine/assess";
import { buildMetrics } from "../src/lib/ai/metrics";
import { deterministicDraft } from "../src/lib/ai/fallback";

// Simulates Gemini over HTTP to exercise the live path: model discovery,
// schema-checked parsing, caching, rate limiting and fallbacks.

function geminiReply(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
}

describe("runCopilot live path", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL;
    process.env.LIVE_RUNS_PER_IP_PER_DAY = "2";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("discovers a flash-lite model, drafts, verifies and caches", async () => {
    const x = assess(getBook()[0]);
    const { metrics, unknowns } = buildMetrics(x);
    const good = deterministicDraft(x, metrics, unknowns);
    good.qbr.executiveSummary.push({ text: "Seat utilization is 99%.", metricIds: ["seat_util"] }); // planted error
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/models?")) {
        return new Response(JSON.stringify({ models: [
          { name: "models/gemini-3.6-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-3.1-flash-lite-preview", supportedGenerationMethods: ["generateContent"] },
        ] }));
      }
      return geminiReply(JSON.stringify(good));
    }));
    const { runCopilot } = await import("../src/lib/ai/copilot");
    const r1 = await runCopilot(x, "1.1.1.1");
    expect(r1.source.kind).toBe("gemini");
    expect(r1.source.model).toBe("gemini-3.1-flash-lite");
    expect(r1.verification.claimsUnverified).toBe(1);
    expect(calls.some((c) => c.includes("gemini-3.1-flash-lite:generateContent"))).toBe(true);
    const r2 = await runCopilot(x, "1.1.1.1");
    expect(r2.source.cached).toBe(true);
  });

  it("falls back when Gemini returns 429 and when rate limit is hit", async () => {
    process.env.GEMINI_MODEL = "gemini-x";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    const { runCopilot } = await import("../src/lib/ai/copilot");
    const book = getBook();
    const r = await runCopilot(assess(book[1]), "2.2.2.2");
    expect(r.source.kind).toBe("deterministic");
    expect(r.source.reason).toMatch(/quota/);
    await runCopilot(assess(book[2]), "2.2.2.2");
    const r3 = await runCopilot(assess(book[3]), "2.2.2.2");
    expect(r3.source.reason).toMatch(/limit reached/);
    expect(r3.verification.passed).toBe(true);
  });

  it("rejects malformed model output", async () => {
    process.env.GEMINI_MODEL = "gemini-x";
    vi.stubGlobal("fetch", vi.fn(async () => geminiReply('{"qbr": {"headline": 3}}')));
    const { runCopilot } = await import("../src/lib/ai/copilot");
    const r = await runCopilot(assess(getBook()[4]), "3.3.3.3");
    expect(r.source.kind).toBe("deterministic");
    expect(r.source.reason).toMatch(/schema/);
  });
});
