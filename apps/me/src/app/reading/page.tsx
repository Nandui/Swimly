"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Section, Tag, useLoad } from "@/components/ui";
import { date, day } from "@/lib/format";
import { READING_META } from "@/lib/meta";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

type Item = { documentId: string; title: string; reference: string; version: number; dueOn: string | null; status: string; acknowledgedAt: string | null; overdue: boolean };

export default function ReadingPage() {
  const { data, error, reload } = useLoad<{ items: Item[] }>("reading");
  const open = data?.items.filter((r) => r.status === "outstanding") ?? [];
  const done = data?.items.filter((r) => r.status === "completed") ?? [];
  const meta = (r: Item) => r.status === "completed" ? READING_META.completed : r.overdue ? READING_META.overdue : READING_META.outstanding;
  const list = (items: Item[], empty: string) => items.length === 0 ? <EmptyRows>{empty}</EmptyRows> : (
    <ul className="pc-list">{items.map((r) => (
      <li key={`${r.documentId}-${r.version}`}><Link href={`/reading/${r.documentId}`} className="pc-row">
        <span className="pc-row-body"><span className="pc-row-title">{r.title}</span>
          <span className="pc-row-hint">{r.reference} · version {r.version} · {r.acknowledgedAt ? `read ${date(r.acknowledgedAt)}` : r.dueOn ? `due ${day(r.dueOn)}` : "no deadline"}</span></span>
        <span className="pc-row-trail"><Tag meta={meta(r)} /><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
      </Link></li>
    ))}</ul>
  );
  return (
    <Frame title="Required reading">
      <PageShell spacing="roomy" header={<PageHeader back={{ href: "/more", label: "More" }} title="Required reading" description="Procedures and policies you need to read and acknowledge." />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <Section id="r-open" title="To read" aside={open.length ? <p>{open.length}</p> : null}>{list(open, "Nothing to read right now.")}</Section>
            <Section id="r-done" title="Read" aside={done.length ? <p>{done.length}</p> : null}>{list(done, "Nothing acknowledged yet.")}</Section>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
