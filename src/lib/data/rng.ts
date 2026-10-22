// Seeded PRNG (mulberry32) so the demo book and training history are reproducible.
export function rng(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean = 0, sd = 1) => {
    const u = Math.max(next(), 1e-9);
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const int = (lo: number, hi: number) => Math.floor(lo + next() * (hi - lo + 1));
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)];
  const chance = (p: number) => next() < p;
  const poisson = (lambda: number) => {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do { k++; p *= next(); } while (p > L);
    return k - 1;
  };
  return { next, normal, int, pick, chance, poisson };
}
export type Rng = ReturnType<typeof rng>;
