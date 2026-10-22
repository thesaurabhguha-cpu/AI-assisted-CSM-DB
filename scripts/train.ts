// Trains the churn model on synthetic labeled history and writes model-weights.json.
// Run: npm run train
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateHistory } from "../src/lib/data/generate";
import { FEATURES } from "../src/lib/engine/features";
import { computeHealth } from "../src/lib/engine/health";
import { auc, fitLogistic } from "../src/lib/engine/model";

const SEED = 7;
const N = 2400;
const data = generateHistory(N, SEED);

// Deterministic 70/30 split.
const train = data.filter((_, i) => i % 10 < 7);
const test = data.filter((_, i) => i % 10 >= 7);

const keys = FEATURES.map((f) => f.key);
const raw = (a: (typeof data)[number]["account"]) => FEATURES.map((f) => f.get(a));

const mean = keys.map((_, j) => {
  const vals = train.map((d) => raw(d.account)[j]).filter((v): v is number => v !== null);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
});
const std = keys.map((_, j) => {
  const vals = train.map((d) => raw(d.account)[j]).filter((v): v is number => v !== null);
  const m = mean[j];
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length) || 1;
});
const z = (a: (typeof data)[number]["account"]) => raw(a).map((v, j) => (v === null ? 0 : (v - mean[j]) / std[j]));

const { coef, intercept } = fitLogistic(train.map((d) => z(d.account)), train.map((d) => d.churned));
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const prob = (a: (typeof data)[number]["account"]) => sig(intercept + z(a).reduce((s, v, j) => s + v * coef[j], 0));

const yTest = test.map((d) => d.churned);
const pTest = test.map((d) => prob(d.account));
const aucModel = auc(pTest, yTest);
const aucHealth = auc(test.map((d) => 100 - computeHealth(d.account).score), yTest);
const brier = pTest.reduce((s, p, i) => s + (p - yTest[i]) ** 2, 0) / pTest.length;
const churnRate = data.reduce((s, d) => s + d.churned, 0) / data.length;

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const out = {
  features: keys,
  mean: mean.map(r4),
  std: std.map(r4),
  coef: coef.map(r4),
  intercept: r4(intercept),
  metrics: {
    nTrain: train.length,
    nTest: test.length,
    churnRate: r4(churnRate),
    aucModel: r4(aucModel),
    aucHealthScore: r4(aucHealth),
    brier: r4(brier),
    trainedAt: new Date().toISOString().slice(0, 10),
    seed: SEED,
  },
};
writeFileSync(join(__dirname, "../src/lib/engine/model-weights.json"), JSON.stringify(out, null, 2) + "\n");
console.log(out.metrics);
console.table(keys.map((k, j) => ({ feature: k, coef: out.coef[j] })));
