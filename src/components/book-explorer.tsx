"use client";
import { useRef, useState } from "react";
import { AccountTable, type Row } from "./account-table";
import { Isotype, type IsoGroup } from "./isotype";

// Links the ARR isotype to the account table: picking a group filters the book.
export function BookExplorer({ groups, rows, tableHeader }: { groups: IsoGroup[]; rows: Row[]; tableHeader: React.ReactNode }) {
  const [group, setGroup] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const pick = (k: string | null) => {
    setGroup(k);
    if (k) tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <section className="mt-14" aria-labelledby="iso-h">
        <h2 id="iso-h" className="text-xl font-medium">Where the ARR sits</h2>
        <p className="text-sm text-ink-3 mt-1 mb-4">Each square is $25k of ARR. Select a group to filter the book.</p>
        <Isotype groups={groups} active={group} onPick={pick} />
      </section>
      <section className="mt-14 scroll-mt-6" aria-labelledby="book-h" ref={tableRef}>
        {tableHeader}
        <AccountTable rows={rows} group={group} groupLabel={groups.find((g) => g.key === group)?.label} onClearGroup={() => setGroup(null)} />
      </section>
    </>
  );
}
