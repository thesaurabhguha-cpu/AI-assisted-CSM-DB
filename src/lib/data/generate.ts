import type { AccountSnapshot, Archetype, DemoAccount, Segment } from "../types";
import { rng, type Rng } from "./rng";

// Synthetic book for "Loomwork", a fictional B2B collaboration SaaS vendor.
// Every company, person and number here is invented.

interface Profile {
  util: number; dau: number; adopt: number; trend: number;
  open: number; p1: number; sent: number; nps: number | null; csat: number;
  late: number; exec: number; champ: number; npsMissing: number;
}

export const PROFILES: Record<Archetype, Profile> = {
  steady:            { util: 0.8,  dau: 0.42, adopt: 5.5, trend: 0.03,  open: 1.5, p1: 0.2, sent: 0.25,  nps: 8,  csat: 4.3, late: 0.2, exec: 0.6,  champ: 0.08, npsMissing: 0.15 },
  "silent-churner":  { util: 0.88, dau: 0.48, adopt: 6.5, trend: 0.0,   open: 1,   p1: 0.1, sent: -0.05, nps: 7,  csat: 4.0, late: 0.3, exec: 0.1,  champ: 0.92, npsMissing: 0.35 },
  "usage-cliff":     { util: 0.5,  dau: 0.22, adopt: 4,   trend: -0.38, open: 2,   p1: 0.4, sent: -0.1,  nps: 5,  csat: 3.5, late: 0.6, exec: 0.3,  champ: 0.4,  npsMissing: 0.3 },
  "ticket-storm":    { util: 0.7,  dau: 0.35, adopt: 5,   trend: -0.1,  open: 7,   p1: 2.5, sent: -0.55, nps: 4,  csat: 2.6, late: 0.4, exec: 0.4,  champ: 0.2,  npsMissing: 0.2 },
  "loud-but-loyal":  { util: 0.78, dau: 0.4,  adopt: 6.5, trend: 0.05,  open: 5,   p1: 1.2, sent: -0.2,  nps: 8,  csat: 3.6, late: 0,   exec: 0.95, champ: 0.05, npsMissing: 0.1 },
  "expansion-ready": { util: 0.99, dau: 0.52, adopt: 7,   trend: 0.15,  open: 1,   p1: 0.1, sent: 0.45,  nps: 9,  csat: 4.6, late: 0,   exec: 0.8,  champ: 0.05, npsMissing: 0.1 },
  onboarding:        { util: 0.55, dau: 0.35, adopt: 3,   trend: 0.1,   open: 2,   p1: 0.2, sent: 0.1,   nps: null, csat: 4.0, late: 0.1, exec: 0.5, champ: 0.1,  npsMissing: 1 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

const SEGMENT_SEATS: Record<Segment, [number, number]> = { SMB: [15, 60], "Mid-Market": [80, 300], Enterprise: [400, 1500] };
const SEGMENT_ARR_PER_SEAT: Record<Segment, number> = { SMB: 420, "Mid-Market": 380, Enterprise: 330 };

export function synthAccount(r: Rng, id: string, archetype: Archetype, segment: Segment): AccountSnapshot {
  const p = PROFILES[archetype];
  const seatsPurchased = r.int(...SEGMENT_SEATS[segment]);
  const util = clamp(r.normal(p.util, 0.07), 0.15, 1);
  const seatsActive = Math.round(seatsPurchased * util);
  const tenureDays = archetype === "onboarding" ? r.int(30, 110) : r.int(200, 1400);
  const npsMissing = r.chance(p.npsMissing);
  const sentMissing = r.chance(0.08);
  return {
    id,
    name: id,
    segment,
    industry: "",
    plan: segment === "Enterprise" ? "Enterprise" : segment === "Mid-Market" ? "Business" : "Team",
    arr: Math.round((seatsPurchased * SEGMENT_ARR_PER_SEAT[segment] * clamp(r.normal(1, 0.08), 0.8, 1.2)) / 100) * 100,
    tenureDays,
    daysToRenewal: r.int(10, 330),
    seatsPurchased,
    seatsActive,
    dauMau: r2(clamp(r.normal(p.dau, 0.05), 0.05, 0.7)),
    featuresAdopted: Math.round(clamp(r.normal(p.adopt, 0.9), 1, 8)),
    usageTrend90d: r2(clamp(r.normal(p.trend, 0.06), -0.7, 0.5)),
    ticketsOpen: r.poisson(p.open),
    p1Tickets90d: r.poisson(p.p1),
    ticketSentiment: sentMissing ? null : r2(clamp(r.normal(p.sent, 0.15), -1, 1)),
    avgResolutionHrs: r.chance(0.1) ? null : Math.round(clamp(r.normal(16 + p.p1 * 10, 6), 2, 96)),
    nps: npsMissing || p.nps === null ? null : Math.round(clamp(r.normal(p.nps, 1.1), 0, 10)),
    csat: r.chance(0.1) ? null : Math.round(clamp(r.normal(p.csat, 0.3), 1, 5) * 10) / 10,
    latePayments12m: r.poisson(p.late),
    execSponsorEngaged: r.chance(p.exec),
    championChanged90d: r.chance(p.champ),
    lastQbrDaysAgo: r.chance(0.25) ? null : r.int(20, 200),
  };
}

// Ground-truth churn process for the synthetic history. It weights the
// relationship and sentiment signals that rules-based scores tend to miss,
// which is what makes a learned model worth having.
export function trueChurnLogit(a: AccountSnapshot) {
  const util = a.seatsPurchased ? a.seatsActive / a.seatsPurchased : 0;
  return (
    -1.6 +
    2.4 * (a.championChanged90d ? 1 : 0) -
    1.6 * (a.ticketSentiment ?? 0) -
    2.5 * a.usageTrend90d -
    2.0 * (util - 0.75) +
    0.35 * a.p1Tickets90d +
    0.45 * a.latePayments12m -
    1.1 * (a.execSponsorEngaged ? 1 : 0) -
    0.18 * (a.featuresAdopted - 5) -
    (a.nps === null ? 0 : 0.15 * (a.nps - 7))
  );
}

const HISTORY_MIX: [Archetype, number][] = [
  ["steady", 0.38], ["silent-churner", 0.12], ["usage-cliff", 0.1], ["ticket-storm", 0.1],
  ["loud-but-loyal", 0.1], ["expansion-ready", 0.12], ["onboarding", 0.08],
];

export function generateHistory(n: number, seed: number): { account: AccountSnapshot; churned: number }[] {
  const r = rng(seed);
  const out: { account: AccountSnapshot; churned: number }[] = [];
  for (let i = 0; i < n; i++) {
    let x = r.next();
    let arch: Archetype = "steady";
    for (const [a, w] of HISTORY_MIX) { if ((x -= w) <= 0) { arch = a; break; } }
    const seg = r.pick(["SMB", "SMB", "Mid-Market", "Mid-Market", "Enterprise"] as const);
    const account = synthAccount(r, `H${i}`, arch, seg);
    const logit = trueChurnLogit(account) + r.normal(0, 0.6);
    out.push({ account, churned: r.next() < 1 / (1 + Math.exp(-logit)) ? 1 : 0 });
  }
  return out;
}

// ------------------------------ the demo book ------------------------------

interface BookEntry {
  name: string; industry: string; segment: Segment; archetype: Archetype;
  champion: [string, string]; goals: string[];
}

const BOOK: BookEntry[] = [
  { name: "Halvorsen Freight", industry: "Logistics", segment: "Enterprise", archetype: "silent-churner", champion: ["Ingrid Halloway", "Director of Operations"], goals: ["Cut shipment exception handling time by 25%", "Standardize dispatch workflows across 6 depots"] },
  { name: "Quillon Health", industry: "Healthcare", segment: "Enterprise", archetype: "ticket-storm", champion: ["Marcus Obi", "VP Clinical Systems"], goals: ["Move referral intake onto shared boards", "Pass internal security review for PHI-adjacent work"] },
  { name: "Brightmoor Legal", industry: "Legal", segment: "Mid-Market", archetype: "silent-churner", champion: ["Selena Varga", "Practice Operations Lead"], goals: ["Track matter deadlines in one place", "Reduce status-update meetings by half"] },
  { name: "Pinecrest Analytics", industry: "Data services", segment: "Mid-Market", archetype: "expansion-ready", champion: ["Devika Raman", "Head of Delivery"], goals: ["Roll out to the data engineering team", "Automate weekly client reporting"] },
  { name: "Tamsin & Rowe", industry: "Architecture", segment: "SMB", archetype: "usage-cliff", champion: ["Oliver Tamsin", "Partner"], goals: ["Replace spreadsheet project tracker"] },
  { name: "Corrigan Biotech", industry: "Life sciences", segment: "Enterprise", archetype: "loud-but-loyal", champion: ["Hannah Corrigan", "Director, Lab Operations"], goals: ["Coordinate trial-site onboarding", "Integrate with LIMS by Q2"] },
  { name: "Velaro Retail Group", industry: "Retail", segment: "Enterprise", archetype: "steady", champion: ["Tomás Ruiz", "Senior Manager, Store Ops"], goals: ["Launch seasonal campaigns 2 weeks faster"] },
  { name: "Norrland Energy", industry: "Energy", segment: "Enterprise", archetype: "silent-churner", champion: ["Linnea Berg", "Program Manager, Grid Projects"], goals: ["Single view of field project status", "Retire legacy PMO tool"] },
  { name: "Okafor & Lane", industry: "Accounting", segment: "SMB", archetype: "steady", champion: ["Ada Okafor", "Managing Partner"], goals: ["Close-month checklist with zero missed steps"] },
  { name: "Driftline Studios", industry: "Media", segment: "Mid-Market", archetype: "usage-cliff", champion: ["Jules Marchetti", "Head of Production"], goals: ["Track post-production pipeline", "Share review boards with clients"] },
  { name: "Ashgrove Schools Trust", industry: "Education", segment: "Mid-Market", archetype: "onboarding", champion: ["Priya Nandakumar", "Digital Lead"], goals: ["Onboard 4 schools by end of term", "Move staff rota planning online"] },
  { name: "Keystone Mutual", industry: "Insurance", segment: "Enterprise", archetype: "ticket-storm", champion: ["Robert Kline", "Claims Transformation Lead"], goals: ["Cut claims handoff time by 30%"] },
  { name: "Sablewood Hotels", industry: "Hospitality", segment: "Mid-Market", archetype: "steady", champion: ["Camille Durand", "Group Operations Manager"], goals: ["Standardize property opening checklists"] },
  { name: "Ferrovia Rail Services", industry: "Transport", segment: "Enterprise", archetype: "expansion-ready", champion: ["Matteo Ferri", "Head of PMO"], goals: ["Expand from engineering to procurement", "Portfolio reporting for the board"] },
  { name: "Lumen Dental Partners", industry: "Healthcare", segment: "SMB", archetype: "silent-churner", champion: ["Grace Whitfield", "Practice Manager"], goals: ["Coordinate 3 clinics' supply orders"] },
  { name: "Arkwright Manufacturing", industry: "Manufacturing", segment: "Enterprise", archetype: "steady", champion: ["Neil Arkwright", "Continuous Improvement Lead"], goals: ["Digitize line-change procedures", "Track kaizen projects"] },
  { name: "Mosaic Nonprofit Network", industry: "Nonprofit", segment: "SMB", archetype: "loud-but-loyal", champion: ["Fatima Haddad", "Operations Director"], goals: ["Grant deadline tracking across programs"] },
  { name: "Cobalt Robotics Lab", industry: "Technology", segment: "Mid-Market", archetype: "steady", champion: ["Ethan Park", "Engineering Manager"], goals: ["Sprint planning with hardware dependencies"] },
  { name: "Harbourline Ports", industry: "Logistics", segment: "Enterprise", archetype: "usage-cliff", champion: ["Siobhan Kerr", "Terminal Systems Manager"], goals: ["Berth scheduling visibility for partners"] },
  { name: "Wrenfield Council", industry: "Public sector", segment: "Mid-Market", archetype: "onboarding", champion: ["Daniel Osei", "Service Improvement Officer"], goals: ["Move citizen-request triage onto boards"] },
  { name: "Greystone Capital", industry: "Financial services", segment: "Mid-Market", archetype: "silent-churner", champion: ["Victoria Lam", "COO"], goals: ["Deal-room task tracking", "Audit trail for approvals"] },
  { name: "Juniper Foods Co.", industry: "Food & beverage", segment: "Mid-Market", archetype: "expansion-ready", champion: ["Rafael Mendes", "Supply Chain Director"], goals: ["Supplier onboarding workflow", "Add QA team in Q1"] },
  { name: "Tidewater Marine", industry: "Maritime", segment: "SMB", archetype: "ticket-storm", champion: ["Owen Pryce", "Fleet Coordinator"], goals: ["Maintenance schedule tracking"] },
  { name: "Elmstead Property", industry: "Real estate", segment: "SMB", archetype: "steady", champion: ["Rachel Elm", "Portfolio Manager"], goals: ["Tenant request pipeline"] },
  { name: "Solstice Telecom", industry: "Telecom", segment: "Enterprise", archetype: "loud-but-loyal", champion: ["Arjun Mehta", "Head of Field Operations"], goals: ["Field job coordination across regions", "Reduce truck rolls by 10%"] },
  { name: "Brindle Creative", industry: "Marketing", segment: "SMB", archetype: "expansion-ready", champion: ["Nadia Brindle", "Agency Director"], goals: ["Client approval workflows"] },
  { name: "Orion Aerospace Parts", industry: "Aerospace", segment: "Enterprise", archetype: "steady", champion: ["Henrik Larsen", "Quality Systems Manager"], goals: ["Non-conformance tracking", "AS9100 audit readiness"] },
  { name: "Vantage Clinics", industry: "Healthcare", segment: "Mid-Market", archetype: "usage-cliff", champion: ["Imogen Shaw", "Operations Lead"], goals: ["Shift handover boards for 5 sites"] },
  { name: "Northgate Univ. Press", industry: "Publishing", segment: "SMB", archetype: "onboarding", champion: ["Laurence Achebe", "Managing Editor"], goals: ["Manuscript production tracking"] },
  { name: "Copperleaf Engineering", industry: "Engineering", segment: "Mid-Market", archetype: "steady", champion: ["Sofia Novak", "Projects Director"], goals: ["Resource planning across 40 projects"] },
];

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const BOOK_SEED = 20261022;

function weeklySeries(r: Rng, a: AccountSnapshot, archetype: Archetype): number[] {
  const end = a.seatsActive;
  const weeks = 52;
  const out: number[] = [];
  const start = archetype === "onboarding" ? Math.max(3, Math.round(end * 0.15)) : end / (1 + a.usageTrend90d);
  const onboardWeeks = archetype === "onboarding" ? Math.min(weeks, Math.round(a.tenureDays / 7)) : 0;
  for (let w = 0; w < weeks; w++) {
    const weeksAgo = weeks - 1 - w;
    let v: number;
    if (archetype === "onboarding") {
      if (weeksAgo >= onboardWeeks) { out.push(0); continue; }
      const t = 1 - weeksAgo / Math.max(onboardWeeks, 1);
      v = start + (end - start) * t;
    } else if (weeksAgo > 13) {
      v = start * (1 + 0.04 * Math.sin(w / 3));
    } else if (archetype === "usage-cliff") {
      v = weeksAgo > 8 ? start : end + (start - end) * (weeksAgo / 8) ** 2;
    } else {
      v = start + (end - start) * (1 - weeksAgo / 13);
    }
    out.push(Math.max(0, Math.round(v * (1 + r.normal(0, 0.03)))));
  }
  out[weeks - 1] = end;
  return out;
}

let cached: DemoAccount[] | null = null;

export function getBook(): DemoAccount[] {
  if (cached) return cached;
  const r = rng(BOOK_SEED);
  cached = BOOK.map((e) => {
    const base = synthAccount(r, slug(e.name), e.archetype, e.segment);
    const a: AccountSnapshot = {
      ...base,
      name: e.name,
      industry: e.industry,
      champion: { name: e.champion[0], title: e.champion[1] },
      goals: e.goals,
    };
    // Make each archetype unambiguous so the demo story is stable.
    if (e.archetype === "silent-churner") {
      a.championChanged90d = true;
      a.execSponsorEngaged = false;
      a.usageTrend90d = Math.max(a.usageTrend90d, -0.03);
      a.seatsActive = Math.max(a.seatsActive, Math.round(a.seatsPurchased * 0.86));
      a.dauMau = Math.max(a.dauMau, 0.46);
      a.featuresAdopted = Math.max(a.featuresAdopted, 6);
      a.ticketsOpen = Math.min(a.ticketsOpen, 1);
      a.p1Tickets90d = 0;
      a.latePayments12m = Math.min(a.latePayments12m, 1);
      a.daysToRenewal = r.int(35, 110);
    }
    if (e.archetype === "loud-but-loyal") {
      a.execSponsorEngaged = true;
      a.championChanged90d = false;
      a.ticketsOpen = Math.max(a.ticketsOpen, 8);
      a.p1Tickets90d = Math.max(a.p1Tickets90d, 3);
      a.ticketSentiment = -0.4;
      a.csat = 3.1;
      a.nps = 8;
      a.usageTrend90d = 0.02;
      a.dauMau = Math.min(a.dauMau, 0.36);
      a.seatsActive = Math.round(a.seatsPurchased * 0.8);
      a.featuresAdopted = 7;
    }
    if (e.archetype === "expansion-ready") {
      a.seatsActive = Math.min(a.seatsPurchased, Math.max(a.seatsActive, Math.round(a.seatsPurchased * 0.97)));
      a.championChanged90d = false;
    }
    if (e.archetype === "usage-cliff") a.usageTrend90d = Math.min(a.usageTrend90d, -0.32);
    if (e.archetype === "ticket-storm") { a.p1Tickets90d = Math.max(a.p1Tickets90d, 3); a.ticketsOpen = Math.max(a.ticketsOpen, 6); }
    if (e.archetype === "steady") a.championChanged90d = false;
    const series = {
      weeklyActiveUsers: weeklySeries(r, a, e.archetype),
      ticketsPerMonth: Array.from({ length: 12 }, (_, m) =>
        Math.max(0, Math.round((a.ticketsOpen * 0.8 + a.p1Tickets90d) * (m >= 9 ? 1 : 0.5) + r.normal(0, 1))),
      ),
      events: [
        ...(a.championChanged90d ? [{ weeksAgo: r.int(3, 11), label: "Champion changed" }] : []),
        ...(a.p1Tickets90d >= 2 ? [{ weeksAgo: r.int(1, 10), label: `${a.p1Tickets90d} P1 incidents` }] : []),
        ...(e.archetype === "usage-cliff" ? [{ weeksAgo: 8, label: "Usage drop begins" }] : []),
        ...(a.lastQbrDaysAgo !== null && a.lastQbrDaysAgo < 360 ? [{ weeksAgo: Math.round(a.lastQbrDaysAgo / 7), label: "Last QBR" }] : []),
      ],
    };
    return { ...a, archetype: e.archetype, series };
  });
  return cached;
}

export function getAccount(id: string): DemoAccount | undefined {
  return getBook().find((a) => a.id === id);
}

export const VENDOR = { name: "Loomwork", product: "Loomwork Boards" };
