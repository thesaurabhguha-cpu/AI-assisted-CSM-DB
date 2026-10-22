import { GEMINI_RESPONSE_SCHEMA, isDraft, type Draft } from "./schema";

// Minimal Gemini REST client. The model ID comes from GEMINI_MODEL; if unset or
// retired, we discover a current Flash-Lite model from the models list, because
// Google renames and reroutes model IDs often.

const BASE = "https://generativelanguage.googleapis.com/v1beta";
let resolvedModel: string | null = null;

export class GeminiError extends Error {
  constructor(message: string, public status: number, public kind: "quota" | "auth" | "model" | "bad-output" | "network") {
    super(message);
  }
}

async function discoverModel(key: string): Promise<string> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new GeminiError(`Model list failed (${res.status})`, res.status, res.status === 403 || res.status === 401 ? "auth" : "network");
  const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const names = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  const rank = (n: string) => {
    const ver = parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
    const preview = /preview|exp/.test(n) ? 1 : 0;
    return ver * 10 - preview * 5;
  };
  const lite = names.filter((n) => /flash-lite/.test(n) && !/image|tts|audio|live/.test(n)).sort((a, b) => rank(b) - rank(a));
  const flash = names.filter((n) => /flash/.test(n) && !/image|tts|audio|live/.test(n)).sort((a, b) => rank(b) - rank(a));
  const pick = lite[0] ?? flash[0];
  if (!pick) throw new GeminiError("No Flash model available for this key", 404, "model");
  return pick;
}

export async function generateDraft(system: string, user: string): Promise<{ draft: Draft; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY not configured", 0, "auth");
  let model = resolvedModel ?? process.env.GEMINI_MODEL ?? (await discoverModel(key));

  const call = async (m: string) =>
    fetch(`${BASE}/models/${m}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          maxOutputTokens: 4096,
        },
      }),
    });

  let res: Response;
  try {
    res = await call(model);
    if (res.status === 404) {
      model = await discoverModel(key);
      res = await call(model);
    }
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    throw new GeminiError(`Gemini request failed: ${(e as Error).message}`, 0, "network");
  }
  if (!res.ok) {
    const kind = res.status === 429 ? "quota" : res.status === 401 || res.status === 403 ? "auth" : res.status === 404 ? "model" : "network";
    throw new GeminiError(`Gemini returned ${res.status}`, res.status, kind);
  }
  resolvedModel = model;
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiError("Gemini returned non-JSON output", 200, "bad-output");
  }
  if (!isDraft(parsed)) throw new GeminiError("Gemini output did not match the schema", 200, "bad-output");
  return { draft: parsed, model };
}
