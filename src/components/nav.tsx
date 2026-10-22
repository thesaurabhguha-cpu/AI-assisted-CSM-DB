import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "./nav-links";
import { StatusChip } from "./status-chip";

export function Nav() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line-soft bg-[rgba(20,11,29,0.78)] backdrop-blur-md">
      <div className="mx-auto max-w-[1280px] px-5 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Retain OS home">
          <Mark />
          <span className="font-semibold tracking-tight">Retain OS</span>
        </Link>
        <Suspense fallback={<div className="flex-1" />}>
          <NavLinks />
        </Suspense>
        <StatusChip />
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="9.5" fill="none" stroke="var(--lilac)" strokeWidth="1.5" />
      <circle cx="11" cy="11" r="5" fill="none" stroke="var(--lilac-ink)" strokeWidth="1.5" strokeDasharray="20 12" />
      <circle cx="15.5" cy="6.5" r="2" fill="var(--ochre)" />
    </svg>
  );
}
