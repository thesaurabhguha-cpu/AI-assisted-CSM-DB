"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Book" },
  { href: "/upload", label: "Upload CSV" },
  { href: "/how-it-works", label: "How it works" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex-1 flex items-center gap-1 overflow-x-auto" aria-label="Main">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/accounts") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${active ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
