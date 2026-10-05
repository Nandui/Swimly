"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { date, day } from "@/lib/format";
import { TRAINING_META } from "@/lib/meta";

type Item = { id: string; title: string; state: string; dueOn: string | null; completedAt: string | null };

export default function TrainingPage() {
  const { data, error, reload } = useLoad<{ items: Item[] }>("training");
  const open = data?.items.filter((t) => t.state !== "completed" && t.state !== "cancelled") ?? [];
  const done = data?.items.filter((t) => t.state === "completed") ?? [];
  const list = (items: Item[], empty: string) => items.length === 0 ? <EmptyRows>{empty}</EmptyRows> : (
    <ul className="pc-rows">{items.map((t) => (
      <li key={t.id}><Link href={`/training/${t.id}`} className="pc-row">
        <span className="pc-row-body"><span className="pc-row-title">{t.title}</span><span className="pc-row-hint">{t.completedAt ? `Completed ${date(t.completedAt)}` : t.dueOn ? `Due ${day(t.dueOn)}` : "No deadline"}</span></span>
        <span className="pc-row-trail"><Tag meta={TRAINING_META[t.state]} /><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
      </Link></li>
    ))}</ul>
  );
  return (
    <Frame title="My training">
      <div className="stack">
        <div className="stack-sm"><h1>My training</h1><p className="muted">Courses assigned to you. Open one to read it and mark it done.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="pc-panel" aria-labelledby="t-open"><div className="pc-panel-head"><h2 id="t-open">To do</h2></div>{list(open, "No training to do right now.")}</section>
            <section className="pc-panel" aria-labelledby="t-done"><div className="pc-panel-head"><h2 id="t-done">Completed</h2></div>{list(done, "Nothing completed yet.")}</section>
          </>
        )}
      </div>
    </Frame>
  );
}
