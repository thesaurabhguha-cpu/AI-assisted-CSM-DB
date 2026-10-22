import { createHash } from "node:crypto";
import type { Assessment } from "../types";
import { deterministicDraft } from "./fallback";
import { GeminiError, generateDraft } from "./gemini";
import { buildMetrics, type Metric } from "./metrics";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { Draft } from "./schema";
import { getCached, hit, setCached } from "./store";
import { verifyDraft, type Verification } from "./verify";

export interface CopilotResult {
  draft: Draft;
  verification: Verification;
  metrics: Metric[];
  unknowns: { id: string; label: string }[];
  source: { kind: "gemini" | "deterministic"; model: string | null; cached: boolean; reason: string | null };
  timings: { draftMs: number; verifyMs: number };
  limits: { remainingToday: number | null };
}

const PER_IP_DAILY = Number(process.env.LIVE_RUNS_PER_IP_PER_DAY ?? 5);
const GLOBAL_DAILY = Number(process.env.LIVE_RUNS_GLOBAL_PER_DAY ?? 200);
const DAY = 86_400;
const PROMPT_VERSION = "v3";

export async function runCopilot(x: Assessment, ip: string, opts: { forceDeterministic?: boolean } = {}): Promise<CopilotResult> {
  const { metrics, unknowns } = buildMetrics(x);
  const user = buildUserPrompt(x, metrics, unknowns);
  const cacheKey = `copilot:${PROMPT_VERSION}:${createHash("sha256").update(user).digest("hex").slice(0, 32)}`;

  const finish = (draft: Draft, source: CopilotResult["source"], draftMs: number, remainingToday: number | null): CopilotResult => {
    const t = performance.now();
    const verification = verifyDraft(draft, metrics);
    return { draft, verification, metrics, unknowns, source, timings: { draftMs, verifyMs: Math.round((performance.now() - t) * 10) / 10 }, limits: { remainingToday } };
  };

  const fallback = (reason: string, remaining: number | null) => {
    const t = performance.now();
    const draft = deterministicDraft(x, metrics, unknowns);
    return finish(draft, { kind: "deterministic", model: null, cached: false, reason }, Math.round(performance.now() - t), remaining);
  };

  if (opts.forceDeterministic) return fallback("Deterministic mode requested", null);
  if (!process.env.GEMINI_API_KEY) return fallback("Live AI is not configured on this deployment", null);

  const cached = await getCached<{ draft: Draft; model: string }>(cacheKey);
  if (cached) return finish(cached.draft, { kind: "gemini", model: cached.model, cached: true, reason: null }, 0, null);

  const ipLimit = await hit(`rl:ip:${ip}`, PER_IP_DAILY, DAY);
  if (!ipLimit.ok) return fallback(`Daily live-run limit reached (${PER_IP_DAILY} per visitor). Showing the deterministic draft.`, 0);
  const global = await hit("rl:global", GLOBAL_DAILY, DAY);
  if (!global.ok) return fallback("Today's shared AI quota is used up. Showing the deterministic draft.", ipLimit.remaining);

  const t = performance.now();
  try {
    const { draft, model } = await generateDraft(SYSTEM_PROMPT, user);
    const ms = Math.round(performance.now() - t);
    await setCached(cacheKey, { draft, model }, 7 * DAY);
    return finish(draft, { kind: "gemini", model, cached: false, reason: null }, ms, ipLimit.remaining);
  } catch (e) {
    const err = e instanceof GeminiError ? e : null;
    const reason =
      err?.kind === "quota" ? "Gemini free-tier quota is exhausted for now. Showing the deterministic draft."
      : err?.kind === "auth" ? "The Gemini key was rejected. Showing the deterministic draft."
      : err?.kind === "bad-output" ? "Gemini returned output that failed the schema check. Showing the deterministic draft."
      : "Gemini could not be reached. Showing the deterministic draft.";
    return fallback(reason, ipLimit.remaining);
  }
}
