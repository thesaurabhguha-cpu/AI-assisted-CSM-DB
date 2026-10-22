import Link from "next/link";
import type { Row } from "@/components/account-table";
import { BookExplorer } from "@/components/book-explorer";
import { Stat } from "@/components/bits";
import { RiskRadar } from "@/components/risk-radar";
import { getBook, VENDOR } from "@/lib/data/generate";
import { assess, portfolioStats } from "@/lib/engine/assess";
import { MODEL } from "@/lib/engine/model";
import { usd } from "@/lib/format";

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export default function Home() {
  const rows = getBook().map(assess);
  const s = portfolioStats(rows);
  const silentArr = s.silentChurn.reduce((t, r) => t + r.account.arr, 0);
  const n = s.silentChurn.length;
  const champ = s.silentChurn.filter((r) => r.account.championChanged90d).length;
  const tableRows: Row[] = rows.map((r) => ({
    id: r.account.id,
    name: r.account.name,
    segment: r.account.segment,
    industry: r.account.industry,
    arr: r.account.arr,
    score: r.health.score,
    band: r.health.band,
    prob: r.churn.probability,
    flag: r.flag,
    arrAtRisk: r.arrAtRisk,
    daysToRenewal: r.account.daysToRenewal,
    group: r.flag === "silent-churn" ? "silent" : r.health.band === "healthy" ? "healthy" : r.health.band === "watch" ? "watch" : "risk",
    href: `/accounts/${r.account.id}`,
  }));
  const watchlist = [...rows].sort((a, b) => b.arrAtRisk - a.arrAtRisk).slice(0, 6);
  const sumArr = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((t, r) => t + r.account.arr, 0);

  return (
    <div className="mx-auto max-w-[1280px] px-5">
      {/* Chapter headline + reading key */}
      <section className="grid gap-8 lg:grid-cols-[1fr_340px] pt-12 sm:pt-16 pb-10">
        <div>
          <p className="text-ink-3 text-sm">{VENDOR.name} book of business, {s.accounts} accounts, {usd(s.arr)} ARR</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[0.98] tracking-[-0.035em] font-semibold max-w-[15ch]">
            {WORDS[n] ?? n} accounts look healthy. The model says they’re leaving.
          </h1>
          <p className="mt-6 max-w-[58ch] text-lg text-ink-2 leading-relaxed">
            {usd(silentArr)} of ARR sits behind green health scores. {champ === n ? "Each of these accounts" : `${champ} of them`} lost {champ === n ? "its" : "their"} champion in the last 90 days, which a rules-based score barely notices. Retain OS scores every account, flags the disagreements, and drafts a fact-checked review for each one.
          </p>
        </div>
        <aside className="panel p-5 self-end" aria-label="How to read this page">
          <h2 className="font-medium">Reading the radar</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
            <li className="flex gap-3"><span className="text-moss w-4 text-center" aria-hidden="true">●</span>Healthy, score 70 or higher</li>
            <li className="flex gap-3"><span className="text-ochre w-4 text-center text-xs leading-5" aria-hidden="true">◆</span>Watch, score 50 to 69</li>
            <li className="flex gap-3"><span className="text-brick w-4 text-center text-xs leading-5" aria-hidden="true">▲</span>At risk, score below 50</li>
            <li className="flex gap-3"><span className="text-lilac-ink w-4 text-center" aria-hidden="true">◎</span>Silent churn: healthy score, model churn 40% or higher</li>
          </ul>
          <p className="mt-4 text-xs text-ink-3 leading-relaxed">
            Bubble size is ARR. The score is a transparent weighted formula; the churn probability comes from a logistic model trained on {MODEL.metrics.nTrain.toLocaleString()} synthetic account histories.
          </p>
        </aside>
      </section>

      {/* KPI strip */}
      <section aria-label="Portfolio summary" className="grid grid-cols-2 md:grid-cols-5 gap-6 border-y border-line-soft py-6">
        <Stat label="Portfolio ARR" value={usd(s.arr)} sub={`${s.accounts} accounts`} />
        <Stat label="ARR at risk" value={usd(s.arrAtRisk)} sub="ARR × churn probability" tone="risk" />
        <Stat label="Hidden by green scores" value={usd(silentArr)} sub={`${n} silent-churn accounts`} tone="ai" />
        <Stat label="Renewing in 90 days" value={String(s.renewals90)} sub={`${usd(s.renewals90Arr)} ARR`} />
        <Stat label="Model vs score" value={`${MODEL.metrics.aucModel.toFixed(2)} AUC`} sub={`Health score alone: ${MODEL.metrics.aucHealthScore.toFixed(2)}*`} />
      </section>
      <p className="mt-2 text-xs text-ink-3 max-w-[90ch]">
        * AUC on a held-out split of synthetic accounts. The generator links champion loss to churn by design, so this shows the model can pick up a signal the rules-based score underweights. It is not a claim about accuracy on real customer data. <Link href="/how-it-works" className="underline underline-offset-4 decoration-line hover:text-ink">Method</Link>
      </p>

      {/* Radar + watchlist */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel p-4 sm:p-6 grid-bg">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h2 className="text-xl font-medium">Risk radar</h2>
            <p className="text-sm text-ink-3">Select an account to open it</p>
          </div>
          <RiskRadar
            points={rows.map((r) => ({
              id: r.account.id, name: r.account.name, arr: r.account.arr, score: r.health.score,
              prob: r.churn.probability, band: r.health.band, flag: r.flag, href: `/accounts/${r.account.id}`,
              driver: r.churn.drivers[0]?.logitContribution > 0 ? r.churn.drivers[0].label : undefined,
            }))}
          />
        </div>
        <aside className="panel p-5" aria-labelledby="watch-h">
          <h2 id="watch-h" className="text-xl font-medium">This week’s watchlist</h2>
          <p className="text-sm text-ink-3 mt-1">Ranked by ARR at risk</p>
          <ol className="mt-4 divide-y divide-line-soft">
            {watchlist.map((r, i) => (
              <li key={r.account.id}>
                <Link href={`/accounts/${r.account.id}`} className="flex items-center gap-3 py-3 group">
                  <span className="num text-ink-3 w-5">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate group-hover:underline underline-offset-4 decoration-line">{r.account.name}</span>
                    <span className="block text-xs text-ink-3">
                      {r.flag === "silent-churn" ? <span className="text-lilac-ink">Silent churn</span> : r.churn.drivers[0].logitContribution > 0 ? r.churn.drivers[0].label : "Low risk"}
                      {", renews in "}{r.account.daysToRenewal}d
                    </span>
                  </span>
                  <span className="num text-brick">{usd(r.arrAtRisk)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <BookExplorer
        rows={tableRows}
        groups={[
          { key: "healthy", label: "Healthy and agreed", detail: "Score and model both say stay", arr: sumArr((r) => r.health.band === "healthy" && r.flag !== "silent-churn"), color: "var(--moss)" },
          { key: "silent", label: "Silent churn", detail: "Green score, model says leaving", arr: silentArr, color: "var(--lilac-ink)", ring: true },
          { key: "watch", label: "Watch", detail: "Score 50 to 69", arr: sumArr((r) => r.health.band === "watch"), color: "var(--ochre)" },
          { key: "risk", label: "At risk", detail: "Score below 50", arr: sumArr((r) => r.health.band === "at-risk"), color: "var(--brick)" },
        ]}
        tableHeader={
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 id="book-h" className="text-xl font-medium">The book</h2>
              <p className="text-sm text-ink-3 mt-1">Open any account to see why it scored the way it did and draft its review. Every column sorts.</p>
            </div>
            <Link href="/upload" className="text-sm rounded-lg border border-line px-3 py-1.5 hover:border-lilac">Score your own CSV</Link>
          </div>
        }
      />
    </div>
  );
}
