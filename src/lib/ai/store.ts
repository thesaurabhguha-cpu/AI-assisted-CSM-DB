import { Redis } from "@upstash/redis";

// Cache + rate-limit storage. Uses Upstash Redis when configured (Vercel
// Marketplace sets KV_REST_API_* or UPSTASH_REDIS_REST_*), otherwise an
// in-memory map scoped to the serverless instance (best effort).

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const mem = new Map<string, { v: unknown; exp: number }>();

export const storeKind = redis ? "redis" : "memory";

export async function getCached<T>(key: string): Promise<T | null> {
  if (redis) {
    try { return ((await redis.get<T>(key)) ?? null); } catch { return null; }
  }
  const hit = mem.get(key);
  if (!hit || hit.exp < Date.now()) return null;
  return hit.v as T;
}

export async function setCached(key: string, v: unknown, ttlSec: number) {
  if (redis) {
    try { await redis.set(key, v, { ex: ttlSec }); } catch { /* cache is optional */ }
    return;
  }
  mem.set(key, { v, exp: Date.now() + ttlSec * 1000 });
}

// Fixed-window counter. Returns remaining after this hit, or -1 when blocked.
export async function hit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number }> {
  const bucket = `${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  let n: number;
  if (redis) {
    try {
      n = await redis.incr(bucket);
      if (n === 1) await redis.expire(bucket, windowSec);
    } catch {
      return { ok: true, remaining: limit };
    }
  } else {
    const cur = mem.get(bucket);
    n = ((cur?.v as number) ?? 0) + 1;
    mem.set(bucket, { v: n, exp: Date.now() + windowSec * 1000 });
  }
  return { ok: n <= limit, remaining: Math.max(0, limit - n) };
}

export async function peek(key: string, windowSec: number): Promise<number> {
  const bucket = `${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  if (redis) {
    try { return (await redis.get<number>(bucket)) ?? 0; } catch { return 0; }
  }
  return (mem.get(bucket)?.v as number) ?? 0;
}
