import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BandTag, FlagTag, HealthRing, Stat } from "@/components/bits";
import { DriverChart, ScoreBreakdown } from "@/components/breakdown";
import { CopilotPanel } from "@/components/copilot-panel";
import { UsageChart } from "@/components/usage-chart";
import { getAccount, getBook } from "@/lib/data/generate";
import { assess } from "@/lib/engine/assess";
import { FLAG_META, pct, signedPct, usd } from "@/lib/format";
import type { ModelDriver } from "@/lib/types";

const RISK_PHRASE: Record<string, (d: ModelDriver) => string> = {
  champion: () => "a champion change in the last 90 days",
  exec: () => "no engaged executive sponsor",
  latePayments: (d) => `${d.value} late payment${d.value === "1" ? "" : "s"}`,
  p1: (d) => `${d.value} P1 tickets`,
  usageTrend: (d) => `a ${d.value} usage trend`,
  sentiment: () => "negative ticket sentiment",
  nps: (d) => `an NPS response of ${d.value}`,
  seatUtil: (d) => `${d.value} seat utilization`,
  adoption: (d) => `only ${d.value} features adopted`,
};
const phrase = (d: ModelDriver) => (RISK_PHRASE[d.feature] ?? ((x: ModelDriver) => `${x.label.toLowerCase()} of ${x.value}`))(d);

export function generateStaticParams() {
  return getBook().map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: PageProps<"/accounts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const a = getAccount(id);
  return { title: a ? `${a.name} — Retain OS` : "Account not found — Retain OS" };
}

export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  const account = getAccount(id);
  if (!account) notFound();
  const x = assess(account);
  const a = x.account;
  const util = a.seatsActive / a.seatsPurchased;
  const story =
    x.flag === "silent-churn"
      ? `The score reads ${x.health.score}, comfortably healthy, because usage is strong. The model disagrees: ${x.churn.drivers.filter((d) => d.logitContribution > 0).slice(0, 2).map(phrase).join(" and ")} push 12-month churn to ${pct(x.churn.probability)}.`
      : x.flag === "loud-but-loyal"
        ? `Support load pulls the score down to ${x.health.score}, but the relationship is solid and the model puts churn at only ${pct(x.churn.probability)}. Fix the tickets, protect the sponsor.`
        : `Score and model agree: ${x.health.score} on the health score and ${pct(x.churn.probability)} modeled churn.`;

  return (
    <div className="mx-auto max-w-[1280px] px-5">
      <div className="no-print">
        <nav className="pt-8 text-sm text-ink-3" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">Book</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-ink-2">{a.name}</span>
        </nav>

        <header className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] items-end">
          <div>
            <p className="text-ink-3 text-sm">{a.segment}, {a.industry}, {a.plan} plan, customer for {Math.round(a.tenureDays / 30)} months</p>
            <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.8rem)] leading-[1] tracking-[-0.03em] font-semibold">{a.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <BandTag band={x.health.band} />
              <FlagTag flag={x.flag} />
              {a.champion && <span className="text-sm text-ink-3">Champion: {a.champion.name}, {a.champion.title}</span>}
            </div>
            <p className="mt-5 max-w-[64ch] text-lg text-ink-2 leading-relaxed">{story}</p>
            {x.flag && <p className="mt-2 text-sm text-lilac-ink">{FLAG_META[x.flag].explain}</p>}
          </div>
          <div className="flex items-center gap-6">
            <HealthRing score={x.health.score} band={x.health.band} size={132} />
            <div className="space-y-4">
              <Stat label="Churn probability" value={pct(x.churn.probability)} tone={x.churn.probability >= 0.4 ? "risk" : undefined} />
              <Stat label="ARR at risk" value={usd(x.arrAtRisk)} sub={`of ${usd(a.arr)} ARR`} />
            </div>
          </div>
        </header>

        <section aria-label="Key signals" className="mt-10 grid grid-cols-2 md:grid-cols-6 gap-6 border-y border-line-soft py-6">
          <Stat label="Seats active" value={`${a.seatsActive}/${a.seatsPurchased}`} sub={`${pct(util)} utilization`} />
          <Stat label="DAU/MAU" value={pct(a.dauMau)} />
          <Stat label="90-day usage" value={signedPct(a.usageTrend90d)} tone={a.usageTrend90d <= -0.2 ? "risk" : undefined} />
          <Stat label="Open tickets" value={String(a.ticketsOpen)} sub={`${a.p1Tickets90d} P1 in 90 days`} />
          <Stat label="NPS" value={a.nps === null ? "unknown" : `${a.nps}/10`} sub={a.csat === null ? "CSAT unknown" : `CSAT ${a.csat.toFixed(1)}/5`} />
          <Stat label="Renewal" value={`${a.daysToRenewal} days`} sub={a.lastQbrDaysAgo === null ? "No QBR on record" : `Last QBR ${a.lastQbrDaysAgo} days ago`} />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="panel p-5 sm:p-6">
            <h2 className="text-xl font-medium">Why the score says {x.health.score}</h2>
            <p className="text-sm text-ink-3 mt-1 mb-5">
              Weighted formula{x.health.lifecycle === "onboarding" ? ", onboarding weights (adoption counts more)" : ""}. Score × weight = points.
            </p>
            <ScoreBreakdown health={x.health} />
          </div>
          <div className="panel p-5 sm:p-6">
            <h2 className="text-xl font-medium">Why the model says {pct(x.churn.probability)}</h2>
            <p className="text-sm text-ink-3 mt-1 mb-5">Logistic regression on 12 signals, largest effects for this account first.</p>
            <DriverChart churn={x.churn} />
          </div>
        </section>

        <section className="mt-6 panel p-5 sm:p-6">
          <h2 className="text-xl font-medium">Weekly active users</h2>
          <p className="text-sm text-ink-3 mt-1 mb-4">Last 52 weeks, with account events</p>
          <UsageChart weekly={account.series.weeklyActiveUsers} seats={a.seatsPurchased} events={account.series.events} />
        </section>
      </div>

      <div className="mt-6">
        <CopilotPanel accountId={a.id} accountName={a.name} champion={a.champion} />
      </div>
    </div>
  );
}
