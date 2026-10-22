import { connection } from "next/server";
import { storeKind } from "@/lib/ai/store";
import { MODEL } from "@/lib/engine/model";

export async function GET() {
  await connection();
  return Response.json({
    liveAi: Boolean(process.env.GEMINI_API_KEY),
    modelOverride: process.env.GEMINI_MODEL ?? null,
    store: storeKind,
    perVisitorDailyRuns: Number(process.env.LIVE_RUNS_PER_IP_PER_DAY ?? 5),
    churnModel: MODEL.metrics,
  });
}
