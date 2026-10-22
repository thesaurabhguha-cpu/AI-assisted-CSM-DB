import { getAccount } from "@/lib/data/generate";
import { sanitizeSnapshot } from "@/lib/data/csv";
import { assess } from "@/lib/engine/assess";
import { runCopilot } from "@/lib/ai/copilot";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { accountId?: string; snapshot?: unknown; mode?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body with accountId or snapshot." }, { status: 400 });
  }
  const t0 = performance.now();
  let account;
  if (body.accountId) {
    account = getAccount(String(body.accountId));
    if (!account) return Response.json({ error: "No account with that id in the demo book." }, { status: 404 });
  } else {
    const s = sanitizeSnapshot(body.snapshot);
    if (typeof s === "string") return Response.json({ error: s }, { status: 422 });
    account = s;
  }
  const t1 = performance.now();
  const assessment = assess(account);
  const t2 = performance.now();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "anon";
  const result = await runCopilot(assessment, ip, { forceDeterministic: body.mode === "deterministic" });
  return Response.json({
    assessment: { health: assessment.health, churn: assessment.churn, flag: assessment.flag, arrAtRisk: assessment.arrAtRisk },
    ...result,
    timings: {
      ingestMs: Math.round((t1 - t0) * 10) / 10,
      scoreMs: Math.round((t2 - t1) * 10) / 10,
      ...result.timings,
    },
  });
}
