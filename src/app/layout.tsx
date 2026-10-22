import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Retain OS — AI co-pilot for Customer Success",
  description:
    "Health scores, a churn model that catches silent churn, and fact-checked QBR drafts for a book of B2B SaaS accounts. Demo on synthetic data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="no-print border-t border-line-soft mt-24">
          <div className="mx-auto max-w-[1280px] px-5 py-8 text-sm text-ink-3 flex flex-col sm:flex-row gap-3 justify-between">
            <p>All companies, people and numbers are synthetic. Built by Saurabh Guha as a working demo.</p>
            <a className="hover:text-ink" href="https://github.com/thesaurabhguha-cpu/AI-assisted-CSM-DB">Source on GitHub</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
