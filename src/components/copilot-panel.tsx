"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Metric } from "@/lib/ai/metrics";
import type { Claim, Draft } from "@/lib/ai/schema";
import type { ClaimCheck, Verification } from "@/lib/ai/verify";
import type { AccountSnapshot } from "@/lib/types";

interface ApiResult {
  draft: Draft;
  verification: Verification;
  metrics: Metric[];
  unknowns: { id: string; label: string }[];
  source: { kind: "gemini" | "deterministic"; model: string | null; cached: boolean; reason: string | null };
  timings: { ingestMs: number; scoreMs: number; draftMs: number; verifyMs: number };
  limits: { remainingToday: number | null };
}

const STAGES = [
  { key: "ingest", label: "Ingest", detail: "Validate and bound the account data" },
  { key: "score", label: "Score", detail: "Weighted health score and churn model" },
  { key: "draft", label: "Draft", detail: "Schema-constrained QBR and email" },
  { key: "verify", label: "Verify", detail: "Check every number against source data" },
] as const;

type Phase = "idle" | "running" | "done" | "error";

export function CopilotPanel({
  accountId,
  snapshot,
  accountName,
  champion,
}: {
  accountId?: string;
  snapshot?: AccountSnapshot;
  accountName: string;
  champion?: { name: string; title: string } | null;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(-1);
  const [res, setRes] = useState<ApiResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"qbr" | "email">("qbr");

  async function run(mode?: "deterministic") {
    setPhase("running");
    setErr(null);
    setRes(null);
    setStep(0);
    const tick = (i: number, ms: number) => new Promise<void>((r) => setTimeout(() => { setStep(i); r(); }, reduce ? 0 : ms));
    const req = fetch("/api/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(accountId ? { accountId, mode } : { snapshot, mode }),
    });
    await tick(1, 380);
    await tick(2, 380);
    try {
      const r = await req;
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`);
      await tick(3, 200);
      await tick(4, 450);
      setRes(body as ApiResult);
      setPhase("done");
      setTab("qbr");
    } catch (e) {
      setErr((e as Error).message);
      setPhase("error");
    }
  }

  const timing = (k: string) => {
    if (!res) return null;
    const t = res.timings;
    const v = k === "ingest" ? t.ingestMs : k === "score" ? t.scoreMs : k === "draft" ? t.draftMs : t.verifyMs;
    return v < 1 ? "<1 ms" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
  };

  return (
    <section className="panel-strong p-5 sm:p-7" aria-labelledby="copilot-h">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[60ch]">
          <h2 id="copilot-h" className="text-2xl font-semibold tracking-tight">Co-pilot</h2>
          <p className="text-ink-2 mt-1.5">
            Drafts an executive business review and a save-play email for {accountName}. Every number in the draft is checked against the account data before you see it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run()}
            disabled={phase === "running"}
            className="rounded-xl bg-lilac px-4 py-2.5 font-medium text-[#120a1a] hover:brightness-110 disabled:opacity-60 transition"
          >
            {phase === "running" ? "Drafting…" : res ? "Draft again" : "Draft review and email"}
          </button>
          {res && (
            <button onClick={() => window.print()} className="rounded-xl border border-line px-4 py-2.5 hover:border-lilac">
              Export PDF
            </button>
          )}
        </div>
      </div>

      {/* Pipeline trace */}
      {phase !== "idle" && (
        <ol className="no-print mt-6 grid gap-3 sm:grid-cols-4" aria-label="Pipeline progress">
          {STAGES.map((s, i) => {
            const state = phase === "error" && i >= step ? "error" : i < step || phase === "done" ? "done" : i === step ? "active" : "waiting";
            const isDraft = s.key === "draft";
            return (
              <li key={s.key} className="relative">
                <div className={`rounded-xl border px-3.5 py-3 h-full transition-colors ${state === "done" ? "border-moss/50 bg-moss/5" : state === "active" ? "border-lilac bg-lilac/10" : state === "error" ? "border-brick/60" : "border-line-soft"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.label}</span>
                    <span className="num text-xs text-ink-3">
                      {state === "done" ? timing(s.key) : state === "active" ? <Dots /> : ""}
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 mt-1">
                    {isDraft && res ? (res.source.kind === "gemini" ? `${res.source.model}${res.source.cached ? ", cached" : ", live"}` : "Deterministic engine") : s.detail}
                  </p>
                </div>
                {i < STAGES.length - 1 && (
                  <span aria-hidden="true" className="hidden sm:block absolute top-1/2 -right-3 w-3 h-px bg-line overflow-hidden">
                    {state === "active" && !reduce && (
                      <motion.span className="block h-full w-1/2 bg-lilac-ink" animate={{ x: ["-100%", "200%"] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {err && <p role="alert" className="mt-5 text-brick">The co-pilot could not run: {err}</p>}

      <AnimatePresence>
        {res && (
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mt-6">
            <SourceBar res={res} onDeterministic={() => run("deterministic")} />

            <div className="no-print mt-5 flex gap-1 border-b border-line-soft" role="tablist">
              {(["qbr", "email"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 -mb-px border-b-2 ${tab === t ? "border-lilac text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
                >
                  {t === "qbr" ? "Business review" : "Save-play email"}
                </button>
              ))}
            </div>

            <div className={tab === "qbr" ? "" : "hidden print:block"}>
              <QbrDoc res={res} accountName={accountName} />
            </div>
            <div className={tab === "email" ? "" : "hidden print:block"}>
              <EmailDoc res={res} champion={champion} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Dots() {
  return <span className="inline-flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-lilac-ink animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}</span>;
}

function SourceBar({ res, onDeterministic }: { res: ApiResult; onDeterministic: () => void }) {
  const v = res.verification;
  return (
    <div className="no-print grid gap-3 sm:grid-cols-[auto_1fr] items-start rounded-xl border border-line-soft p-4">
      <div className="flex items-center gap-3">
        <span className={`num text-3xl ${v.passed ? "text-moss" : "text-ochre"}`}>{v.factsVerified}/{v.factsTotal}</span>
        <span className="text-sm text-ink-2 leading-tight">numbers matched<br />to source data</span>
      </div>
      <div className="text-sm text-ink-2 sm:border-l sm:border-line-soft sm:pl-4">
        <p>
          {v.claimsUnverified === 0
            ? "No unsupported claims. Every figure traces to a cited metric."
            : `${v.claimsUnverified} claim${v.claimsUnverified === 1 ? "" : "s"} flagged below. Review before sending.`}
        </p>
        <p className="mt-1 text-ink-3">
          {res.source.kind === "gemini"
            ? `Drafted by ${res.source.model}${res.source.cached ? " (cached result)" : ""}.`
            : res.source.reason}
          {res.source.kind === "gemini" && (
            <> <button onClick={onDeterministic} className="underline underline-offset-4 hover:text-ink">Compare with the deterministic draft</button></>
          )}
        </p>
      </div>
    </div>
  );
}

function useChecks(res: ApiResult) {
  const map = new Map(res.verification.checks.map((c) => [c.path, c]));
  return (path: string) => map.get(path);
}

function ClaimLine({ claim, check, metrics }: { claim: Claim; check?: ClaimCheck; metrics: Metric[] }) {
  const status = check?.status ?? "qualitative";
  const cited = claim.metricIds.map((id) => metrics.find((m) => m.id === id)).filter((m): m is Metric => !!m);
  return (
    <div className={`group rounded-lg ${status === "unverified" ? "border border-ochre/50 bg-ochre/5 p-2 -mx-2" : ""}`}>
      <p className="leading-relaxed">
        <span
          className={`mr-2 inline-block w-4 text-center no-print ${status === "verified" ? "text-moss" : status === "unverified" ? "text-ochre" : "text-ink-3"}`}
          title={status === "verified" ? "Every number matches a cited metric" : status === "unverified" ? "Needs review" : "No figures to check; cites its sources"}
          aria-label={status}
        >
          {status === "verified" ? "✓" : status === "unverified" ? "!" : "○"}
        </span>
        {claim.text}
      </p>
      {status === "unverified" && check?.reasons.length ? (
        <p className="text-xs text-ochre mt-1 ml-6">{check.reasons.join("; ")}</p>
      ) : null}
      {cited.length > 0 && (
        <p className="no-print mt-1 ml-6 flex flex-wrap gap-1.5">
          {cited.slice(0, 6).map((m) => (
            <span key={m.id} title={m.label} className="num text-[11px] rounded border border-line-soft px-1.5 py-0.5 text-ink-3">
              {m.id} <span className="text-ink-2">{m.display.length > 28 ? m.display.slice(0, 26) + "…" : m.display}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function QbrDoc({ res, accountName }: { res: ApiResult; accountName: string }) {
  const q = res.draft.qbr;
  const get = useChecks(res);
  const section = (title: string, key: keyof typeof q, list: Claim[]) => (
    <section className="mt-7">
      <h4 className="font-semibold text-lg">{title}</h4>
      <div className="mt-2.5 space-y-2.5">
        {list.map((c, i) => <ClaimLine key={i} claim={c} check={get(`qbr.${String(key)}[${i}]`)} metrics={res.metrics} />)}
      </div>
    </section>
  );
  return (
    <article className="print-doc mt-6 rounded-xl bg-[#1a0f25] border border-line-soft p-6 sm:p-9 max-w-[860px]">
      <p className="text-sm text-ink-3">Executive business review, {accountName}</p>
      <h3 className="mt-2 text-[clamp(1.6rem,3vw,2.2rem)] leading-tight font-semibold tracking-tight">{q.headline}</h3>
      {section("Summary", "executiveSummary", q.executiveSummary)}
      {section("Value delivered", "valueDelivered", q.valueDelivered)}
      {section("Adoption", "adoption", q.adoption)}
      {section("Risks (internal)", "risks", q.risks)}
      <section className="mt-7">
        <h4 className="font-semibold text-lg">Recommended actions</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-ink-3 border-b border-line-soft">
                <th className="font-normal py-2 pr-4">Action</th>
                <th className="font-normal py-2 pr-4">Owner</th>
                <th className="font-normal py-2 pr-4">When</th>
                <th className="font-normal py-2">Why</th>
              </tr>
            </thead>
            <tbody>
              {q.recommendations.map((r, i) => {
                const ck = get(`qbr.recommendations[${i}]`);
                return (
                  <tr key={i} className="border-b border-line-soft/60 align-top">
                    <td className="py-2.5 pr-4 font-medium">{r.action}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{r.owner}</td>
                    <td className="py-2.5 pr-4 text-ink-2 whitespace-nowrap">{r.timeframe}</td>
                    <td className={`py-2.5 ${ck?.status === "unverified" ? "text-ochre" : "text-ink-2"}`}>
                      {r.rationale.text}
                      {ck?.status === "unverified" && <span className="block text-xs">{ck.reasons.join("; ")}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {section("What we need from you", "asks", q.asks)}
      <section className="mt-7">
        <h4 className="font-semibold text-lg">Missing data</h4>
        {q.unknowns.length ? (
          <ul className="mt-2.5 space-y-2 text-sm">
            {q.unknowns.map((u, i) => (
              <li key={i} className="flex gap-3"><span className="text-ochre" aria-hidden="true">?</span><span><span className="text-ink">{u.metric}.</span> <span className="text-ink-2">{u.why}</span></span></li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-2">No gaps in the data used for this review.</p>
        )}
      </section>
      <p className="mt-8 text-xs text-ink-3">Generated by Retain OS on synthetic data. {res.verification.factsVerified} of {res.verification.factsTotal} figures verified against source metrics.</p>
    </article>
  );
}

function EmailDoc({ res, champion }: { res: ApiResult; champion?: { name: string; title: string } | null }) {
  const e = res.draft.email;
  const get = useChecks(res);
  const text = `Subject: ${e.subject}\n\n${e.paragraphs.map((p) => p.text).join("\n\n")}`;
  const [copied, setCopied] = useState(false);
  return (
    <article className="print-doc print-break mt-6 rounded-xl border border-line-soft p-6 sm:p-8 max-w-[720px]">
      <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-ink-3">To</dt>
          <dd>{champion ? `${champion.name}, ${champion.title}` : <span className="text-ochre">Champion unknown: add a contact before sending</span>}</dd>
          <dt className="text-ink-3">Subject</dt>
          <dd className="font-medium">{e.subject}</dd>
        </dl>
        <button
          className="no-print rounded-lg border border-line px-3 py-1.5 hover:border-lilac"
          onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })}
        >
          {copied ? "Copied" : "Copy email"}
        </button>
      </div>
      <div className="mt-5 space-y-3.5 border-t border-line-soft pt-5">
        {e.paragraphs.map((p, i) => <ClaimLine key={i} claim={p} check={get(`email.paragraphs[${i}]`)} metrics={res.metrics} />)}
      </div>
      <p className="no-print mt-6 text-xs text-ink-3">Draft only. Nothing is sent from this demo.</p>
    </article>
  );
}
