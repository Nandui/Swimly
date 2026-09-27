"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { date, day } from "@/lib/format";
import { READING_META } from "@/lib/meta";

type Item = { documentId: string; title: string; reference: string; version: number; dueOn: string | null; status: string; acknowledgedAt: string | null; overdue: boolean };

export default function ReadingPage() {
  const { data, error, reload } = useLoad<{ items: Item[] }>("reading");
  const open = data?.items.filter((r) => r.status === "outstanding") ?? [];
  const done = data?.items.filter((r) => r.status === "completed") ?? [];
  const meta = (r: Item) => r.status === "completed" ? READING_META.completed : r.overdue ? READING_META.overdue : READING_META.outstanding;
  const list = (items: Item[], empty: string) => items.length === 0 ? <p className="muted">{empty}</p> : (
    <ul className="list">{items.map((r) => (
      <li key={`${r.documentId}-${r.version}`}><Link href={`/reading/${r.documentId}`} className="item">
        <span className="item-main"><span className="item-title">{r.title}</span>
          <span className="caption">{r.reference} · version {r.version} · {r.acknowledgedAt ? `read ${date(r.acknowledgedAt)}` : r.dueOn ? `due ${day(r.dueOn)}` : "no deadline"}</span></span>
        <span className="row"><Tag meta={meta(r)} /><ChevronRight className="chevron" aria-hidden="true" /></span>
      </Link></li>
    ))}</ul>
  );
  return (
    <Frame title="Required reading">
      <div className="stack">
        <div className="stack-sm"><h1>Required reading</h1><p className="muted">Procedures and policies you need to read and acknowledge.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="card stack-sm" aria-labelledby="r-open"><h2 id="r-open">To read</h2>{list(open, "Nothing to read right now.")}</section>
            <section className="card stack-sm" aria-labelledby="r-done"><h2 id="r-done">Read</h2>{list(done, "Nothing acknowledged yet.")}</section>
          </>
        )}
      </div>
    </Frame>
  );
}
