import type { AccountSnapshot, ChurnResult } from "../types";
import { FEATURES } from "./features";
import weights from "./model-weights.json";

export interface ModelWeights {
  features: string[];
  mean: number[];
  std: number[];
  coef: number[];
  intercept: number;
  metrics: {
    nTrain: number;
    nTest: number;
    churnRate: number;
    aucModel: number;
    aucHealthScore: number;
    brier: number;
    trainedAt: string;
    seed: number;
  };
}

export const MODEL = weights as ModelWeights;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function featureVector(a: AccountSnapshot, w: ModelWeights = MODEL): number[] {
  return w.features.map((key, i) => {
    const def = FEATURES.find((f) => f.key === key)!;
    const v = def.get(a);
    return v === null ? 0 : (v - w.mean[i]) / (w.std[i] || 1);
  });
}

export function predictChurn(a: AccountSnapshot, w: ModelWeights = MODEL): ChurnResult {
  const z = featureVector(a, w);
  let logit = w.intercept;
  const drivers = w.features.map((key, i) => {
    const def = FEATURES.find((f) => f.key === key)!;
    const c = w.coef[i] * z[i];
    logit += c;
    return { feature: key, label: def.label, value: def.fmt(a), logitContribution: c };
  });
  drivers.sort((x, y) => Math.abs(y.logitContribution) - Math.abs(x.logitContribution));
  return { probability: sigmoid(logit), drivers };
}

// ---------- training utilities (used by scripts/train.ts and tests) ----------

export function fitLogistic(
  X: number[][],
  y: number[],
  { epochs = 3000, lr = 0.15, l2 = 0.01 } = {},
): { coef: number[]; intercept: number } {
  const n = X.length;
  const d = X[0].length;
  const coef = new Array(d).fill(0);
  let intercept = 0;
  for (let e = 0; e < epochs; e++) {
    const g = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = intercept;
      for (let j = 0; j < d; j++) z += coef[j] * X[i][j];
      const err = sigmoid(z) - y[i];
      gb += err;
      for (let j = 0; j < d; j++) g[j] += err * X[i][j];
    }
    intercept -= (lr * gb) / n;
    for (let j = 0; j < d; j++) coef[j] -= lr * (g[j] / n + l2 * coef[j]);
  }
  return { coef, intercept };
}

// Rank-based AUC (Mann–Whitney U). Higher score = more likely positive.
export function auc(scores: number[], labels: number[]): number {
  const idx = scores.map((s, i) => [s, labels[i]] as const).sort((a, b) => a[0] - b[0]);
  let rankSumPos = 0;
  let nPos = 0;
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) if (idx[k][1] === 1) { rankSumPos += avgRank; nPos++; }
    i = j + 1;
  }
  const nNeg = idx.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (rankSumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}
