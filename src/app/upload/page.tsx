import type { Metadata } from "next";
import { UploadWorkbench } from "@/components/upload-workbench";
import { COLUMNS } from "@/lib/data/csv";

export const metadata: Metadata = { title: "Upload CSV — Retain OS" };

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-5">
      <header className="no-print pt-12 sm:pt-16 max-w-[70ch]">
        <h1 className="text-[clamp(2.2rem,5vw,3.6rem)] leading-[1] tracking-[-0.03em] font-semibold">Score your own book</h1>
        <p className="mt-5 text-lg text-ink-2 leading-relaxed">
          Upload a CSV of account metrics. Scoring runs in your browser. Drafting a review sends that one account’s metrics to the server, and to Gemini when live AI is on.
        </p>
        <p className="mt-4 rounded-xl border border-ochre/50 bg-ochre/5 px-4 py-3 text-sm text-ink">
          Use mock data only. Live AI runs on Gemini’s free tier, where Google may use inputs to improve its models. Columns that look like personal data, such as emails or phone numbers, are rejected.
        </p>
      </header>
      <UploadWorkbench />
      <details className="no-print mt-12 panel p-5">
        <summary className="cursor-pointer font-medium">CSV columns</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-ink-3 border-b border-line-soft"><th className="font-normal py-2 pr-4">Column</th><th className="font-normal py-2 pr-4">Required</th><th className="font-normal py-2 pr-4">Example</th><th className="font-normal py-2">Meaning</th></tr></thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.key} className="border-b border-line-soft/60">
                  <td className="py-2 pr-4 num">{c.key}</td>
                  <td className="py-2 pr-4 text-ink-2">{c.required ? "yes" : "no"}</td>
                  <td className="py-2 pr-4 num text-ink-2">{c.example}</td>
                  <td className="py-2 text-ink-2">{c.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
