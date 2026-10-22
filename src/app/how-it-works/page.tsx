import type { Metadata } from "next";
import Link from "next/link";
import { FEATURES } from "@/lib/engine/features";
import { MODEL } from "@/lib/engine/model";
import { SILENT_CHURN_PROB } from "@/lib/engine/assess";

export const metadata: Metadata = { title: "How it works — Retain OS" };

const WEIGHTS = [
  ["Usage depth", "Seat utilization and DAU/MAU", 30, 25],
  ["Feature adoption", "Core features in use, of 8", 15, 25],
  ["Usage momentum", "90-day change in weekly actives", 10, 5],
  ["Support load", "Open tickets, P1s, resolution time", 15, 15],
  ["Voice of customer", "NPS, CSAT, ticket sentiment", 15, 10],
  ["Relationship", "Exec sponsor, champion stability", 10, 15],
  ["Commercial", "Late payments", 5, 5],
] as const;

export default function HowItWorks() {
  const m = MODEL.metrics;
  const coefs = MODEL.features.map((k, i) => ({ k, label: FEATURES.find((f) => f.key === k)!.label, c: MODEL.coef[i] })).sort((a, b) => b.c - a.c);
  const maxC = Math.max(...coefs.map((c) => Math.abs(c.c)));

  return (
    <div className="mx-auto max-w-[1280px] px-5">
      <header className="pt-12 sm:pt-16 max-w-[68ch]">
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] leading-[1] tracking-[-0.03em] font-semibold">How the co-pilot decides</h1>
        <p className="mt-5 text-lg text-ink-2 leading-relaxed">
          Three layers, each doing the job it is suited for. Arithmetic stays deterministic, the model finds patterns the formula misses, and the language model only writes prose around numbers it is handed and checked on.
        </p>
      </header>

      <section className="mt-12 panel p-5 sm:p-8 grid-bg" aria-labelledby="arch-h">
        <h2 id="arch-h" className="text-xl font-medium">Pipeline</h2>
        <Architecture />
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel p-5 sm:p-6">
          <h2 className="text-xl font-medium">Layer 1: health score</h2>
          <p className="text-sm text-ink-2 mt-2 max-w-[60ch]">
            A weighted composite from 0 to 100. Weights shift for accounts in their first 120 days, when adoption matters more than momentum. When a signal is missing, its weight is spread across the signals that exist and the gap is listed, never filled in.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-ink-3 border-b border-line-soft">
                  <th className="font-normal py-2 pr-4">Component</th>
                  <th className="font-normal py-2 pr-4">Signals</th>
                  <th className="font-normal py-2 pr-4 text-right">Weight</th>
                  <th className="font-normal py-2 text-right">Onboarding</th>
                </tr>
              </thead>
              <tbody>
                {WEIGHTS.map(([c, s, w, o]) => (
                  <tr key={c} className="border-b border-line-soft/60">
                    <td className="py-2.5 pr-4">{c}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{s}</td>
                    <td className="py-2.5 pr-4 text-right num">{w}%</td>
                    <td className="py-2.5 text-right num text-ink-2">{o}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-3 mt-4">Bands: healthy at 70 and above, watch from 50 to 69, at risk below 50.</p>
        </div>

        <div className="panel p-5 sm:p-6">
          <h2 className="text-xl font-medium">Layer 2: churn model</h2>
          <p className="text-sm text-ink-2 mt-2">
            Logistic regression on {MODEL.features.length} standardized signals, trained on {m.nTrain.toLocaleString()} synthetic account histories with a {Math.round(m.churnRate * 100)}% churn rate and tested on {m.nTest.toLocaleString()} held-out accounts.
          </p>
          <div className="mt-5 space-y-3" role="img" aria-label={`Held-out AUC: model ${m.aucModel.toFixed(2)}, health score ${m.aucHealthScore.toFixed(2)}`}>
            {[
              { label: "Churn model", v: m.aucModel, color: "var(--lilac-ink)" },
              { label: "Health score alone", v: m.aucHealthScore, color: "var(--ink-3)" },
            ].map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-sm"><span>{b.label}</span><span className="num">{b.v.toFixed(3)} AUC</span></div>
                <div className="mt-1 h-2.5 rounded-full bg-line-soft overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${((b.v - 0.5) / 0.5) * 100}%`, background: b.color }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-ink-3">Bars start at 0.5, the AUC of a coin flip. Brier score {m.brier.toFixed(3)}.</p>
          </div>
          <h3 className="mt-6 font-medium">What the model learned</h3>
          <ul className="mt-3 space-y-2">
            {coefs.map((c) => {
              const w = (Math.abs(c.c) / maxC) * 50;
              const up = c.c > 0;
              return (
                <li key={c.k} className="grid grid-cols-[minmax(0,190px)_1fr_56px] items-center gap-3 text-sm">
                  <span className="text-ink-2 truncate">{c.label}</span>
                  <span className="relative h-2" aria-hidden="true">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                    <span className="absolute inset-y-0 rounded-full" style={{ left: up ? "50%" : `${50 - w}%`, width: `${Math.max(w, 0.8)}%`, background: up ? "var(--brick)" : "var(--moss)" }} />
                  </span>
                  <span className="num text-right text-ink-2">{c.c > 0 ? "+" : ""}{c.c.toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-3 mt-3">Coefficients per standard deviation. Champion change is the strongest risk signal, and it barely moves the rules-based score. That gap is the silent-churn flag: healthy score, modeled churn of {Math.round(SILENT_CHURN_PROB * 100)}% or more.</p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-5 sm:p-6">
          <h2 className="text-xl font-medium">Layer 3: drafting</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-2">
            <li><span className="text-ink">Numbers come in, prose goes out.</span> The model receives a registry of named metrics and must cite the IDs behind every claim. Gemini output is constrained to a JSON schema.</li>
            <li><span className="text-ink">Gaps stay gaps.</span> Missing data is listed as unavailable, and the draft must report it rather than estimate it.</li>
            <li><span className="text-ink">Internal stays internal.</span> Churn probability, health score and model drivers can appear in the internal risk notes, never in the customer email.</li>
            <li><span className="text-ink">Uploaded text is untrusted.</span> Names are stripped of markup, values are range-checked, and the prompt marks account data as data only.</li>
          </ul>
        </div>
        <div className="panel p-5 sm:p-6">
          <h2 className="text-xl font-medium">Fact check</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-2">
            <li><span className="text-ink">Every figure is matched.</span> A deterministic checker extracts each number from each claim and matches it to a metric that claim cites, with unit-aware tolerance.</li>
            <li><span className="text-ink">Structure is allowed.</span> Time windows, quarters and denominators such as “of 8” are recognized and skipped.</li>
            <li><span className="text-ink">Failures are shown, not hidden.</span> Unsupported claims are highlighted with the reason, and the score of matched figures sits at the top of the draft.</li>
            <li><span className="text-ink">Always available.</span> With no key, a spent quota or malformed output, a deterministic narrative engine writes the same structure from the same metrics.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 panel p-5 sm:p-6">
        <h2 className="text-xl font-medium">Stack and limits</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-3 text-sm text-ink-2">
          <p><span className="text-ink block mb-1">App</span>Next.js on Vercel. Scoring and the model are plain TypeScript, so they run identically on the server and in the browser.</p>
          <p><span className="text-ink block mb-1">AI</span>Gemini Flash-Lite through the REST API, with the model ID discovered at runtime. Results are cached and live runs are rate-limited per visitor.</p>
          <p><span className="text-ink block mb-1">Data</span>Seeded synthetic data for a fictional SaaS vendor. Training history and the demo book are generated by the same process with different seeds.</p>
        </div>
        <p className="mt-6 text-sm">
          <a className="underline underline-offset-4 hover:text-lilac-ink" href="https://github.com/thesaurabhguha-cpu/AI-assisted-CSM-DB">Read the source and tests on GitHub</a>
          <span className="text-ink-3 mx-3" aria-hidden="true">/</span>
          <Link className="underline underline-offset-4 hover:text-lilac-ink" href="/">Back to the book</Link>
        </p>
      </section>
    </div>
  );
}

function Architecture() {
  const nodes = [
    { x: 20, label: "Account data", sub: "Demo book or your CSV", kind: "in" },
    { x: 205, label: "Health score", sub: "Weighted, explainable", kind: "det" },
    { x: 390, label: "Churn model", sub: "Logistic regression", kind: "ml" },
    { x: 575, label: "Draft", sub: "Gemini, schema-bound", kind: "ai" },
    { x: 760, label: "Fact check", sub: "Numbers vs metrics", kind: "det" },
  ] as const;
  const color = { in: "var(--ink-3)", det: "var(--moss)", ml: "var(--ochre)", ai: "var(--lilac-ink)" };
  return (
    <div className="mt-6 overflow-x-auto">
      <svg viewBox="0 0 940 210" className="w-full min-w-[720px] h-auto" role="img" aria-label="Pipeline: account data to health score to churn model to draft to fact check, with a deterministic fallback for the draft">
        {nodes.slice(0, -1).map((n, i) => (
          <g key={n.label}>
            <line x1={n.x + 160} x2={nodes[i + 1].x} y1={60} y2={60} stroke="var(--line)" strokeWidth={2} />
            <circle r={3.5} fill="var(--lilac-ink)">
              <animateMotion dur="2.4s" repeatCount="indefinite" begin={`-${i * 0.6}s`} path={`M${n.x + 160},60 L${nodes[i + 1].x},60`} />
            </circle>
          </g>
        ))}
        {nodes.map((n) => (
          <g key={n.label}>
            <rect x={n.x} y={22} width={160} height={76} rx={12} fill="var(--surface)" stroke={color[n.kind]} strokeWidth={1.5} />
            <text x={n.x + 16} y={54} className="fill-ink" style={{ fontSize: 15, fontWeight: 600 }}>{n.label}</text>
            <text x={n.x + 16} y={76} className="fill-ink-3" style={{ fontSize: 12 }}>{n.sub}</text>
          </g>
        ))}
        <path d="M655,98 L655,150 L700,150" fill="none" stroke="var(--line)" strokeDasharray="4 4" strokeWidth={1.5} />
        <rect x={700} y={128} width={220} height={44} rx={10} fill="var(--surface)" stroke="var(--line)" />
        <text x={716} y={155} className="fill-ink-2" style={{ fontSize: 12 }}>Fallback: deterministic narrative</text>
        <g style={{ fontSize: 12 }}>
          {[["var(--moss)", "Deterministic"], ["var(--ochre)", "Learned"], ["var(--lilac-ink)", "Language model"]].map(([c, l], i) => (
            <g key={l} transform={`translate(${20 + i * 150} 150)`}>
              <rect width={12} height={12} rx={3} fill="none" stroke={c} strokeWidth={2} />
              <text x={20} y={11} className="fill-ink-2">{l}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
