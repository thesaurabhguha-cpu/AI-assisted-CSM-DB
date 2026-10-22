"use client";
import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { AccountTable, type Row } from "./account-table";
import { CopilotPanel } from "./copilot-panel";
import { RiskRadar } from "./risk-radar";
import { BandTag, FlagTag, HealthRing } from "./bits";
import { DriverChart, ScoreBreakdown } from "./breakdown";
import { rowsToSnapshots, templateCsv } from "@/lib/data/csv";
import { assess } from "@/lib/engine/assess";
import { pct, usd } from "@/lib/format";
import type { AccountSnapshot } from "@/lib/types";

export function UploadWorkbench() {
  const [accounts, setAccounts] = useState<AccountSnapshot[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => accounts.map(assess), [accounts]);
  const sel = rows.find((r) => r.account.id === selected) ?? null;

  function load(text: string, name: string) {
    const p = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
    const r = rowsToSnapshots(p.data, p.meta.fields ?? []);
    setFileName(name);
    setBlocked(r.blocked);
    setErrors(r.errors);
    setAccounts(r.accounts);
    setSelected(r.accounts[0]?.id ?? null);
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 512_000) { setBlocked("Files up to 500 KB only."); setAccounts([]); return; }
    f.text().then((t) => load(t, f.name));
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "retain-os-template.csv";
    el.click();
    URL.revokeObjectURL(url);
  }

  const tableRows: Row[] = rows.map((r) => ({
    id: r.account.id, name: r.account.name, segment: r.account.segment, industry: r.account.industry, arr: r.account.arr,
    score: r.health.score, band: r.health.band, prob: r.churn.probability, flag: r.flag, arrAtRisk: r.arrAtRisk, daysToRenewal: r.account.daysToRenewal,
  }));

  return (
    <div className="mt-10">
      <div className="no-print grid gap-4 md:grid-cols-[1fr_auto]">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-lilac bg-lilac/10" : "border-line"}`}
        >
          <p className="text-lg">{fileName ? `Loaded ${fileName}` : "Drop a CSV here"}</p>
          <p className="text-sm text-ink-3 mt-1">One row per account, up to 100 rows</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => input.current?.click()} className="rounded-xl bg-lilac px-4 py-2.5 font-medium text-[#120a1a] hover:brightness-110">Choose file</button>
            <button onClick={() => load(templateCsv(), "sample template")} className="rounded-xl border border-line px-4 py-2.5 hover:border-lilac">Try the sample</button>
          </div>
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose CSV file" />
        </div>
        <div className="panel p-5 md:w-[300px]">
          <h2 className="font-medium">Start from the template</h2>
          <p className="text-sm text-ink-3 mt-1">Three example accounts. One leaves optional columns blank to show how gaps are handled.</p>
          <button onClick={downloadTemplate} className="mt-4 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-lilac">Download template</button>
        </div>
      </div>

      {blocked && <p role="alert" className="no-print mt-5 rounded-xl border border-brick/60 bg-brick/10 px-4 py-3">{blocked}</p>}
      {errors.length > 0 && (
        <div role="alert" className="no-print mt-5 rounded-xl border border-ochre/50 bg-ochre/5 px-4 py-3 text-sm">
          <p className="font-medium">{errors.length} row{errors.length === 1 ? "" : "s"} skipped</p>
          <ul className="mt-1 text-ink-2 list-disc pl-5">{errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <section className="no-print mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="panel p-4 sm:p-6 grid-bg">
              <h2 className="text-xl font-medium mb-2">Risk radar</h2>
              <RiskRadar
                key={fileName ?? ""}
                onSelect={setSelected}
                points={rows.map((r) => ({ id: r.account.id, name: r.account.name, arr: r.account.arr, score: r.health.score, prob: r.churn.probability, band: r.health.band, flag: r.flag }))}
              />
            </div>
            {sel && (
              <div className="panel p-5">
                <div className="flex items-center gap-4">
                  <HealthRing score={sel.health.score} band={sel.health.band} size={92} stroke={8} />
                  <div className="min-w-0">
                    <h2 className="text-xl font-medium truncate">{sel.account.name}</h2>
                    <p className="text-sm text-ink-2 mt-1">Churn {pct(sel.churn.probability)}, {usd(sel.arrAtRisk)} at risk</p>
                    <div className="mt-2 flex flex-wrap gap-2"><BandTag band={sel.health.band} /><FlagTag flag={sel.flag} /></div>
                  </div>
                </div>
                <div className="mt-6"><DriverChart churn={sel.churn} limit={5} /></div>
              </div>
            )}
          </section>
          <section className="no-print mt-8">
            <AccountTable rows={tableRows} onSelect={setSelected} selected={selected} />
          </section>
          {sel && (
            <>
              <details className="no-print mt-6 panel p-5">
                <summary className="cursor-pointer font-medium">Score breakdown for {sel.account.name}</summary>
                <div className="mt-5 max-w-[640px]"><ScoreBreakdown health={sel.health} /></div>
              </details>
              <div className="mt-6">
                <CopilotPanel key={sel.account.id} snapshot={sel.account} accountName={sel.account.name} champion={null} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
