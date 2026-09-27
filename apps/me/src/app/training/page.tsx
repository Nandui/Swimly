"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { date, day } from "@/lib/format";
import { TRAINING_META } from "@/lib/meta";

type Item = { id: string; title: string; state: string; dueOn: string | null; completedAt: string | null };

export default function TrainingPage() {
  const { data, error, reload } = useLoad<{ items: Item[] }>("training");
  const open = data?.items.filter((t) => t.state !== "completed" && t.state !== "cancelled") ?? [];
  const done = data?.items.filter((t) => t.state === "completed") ?? [];
  const list = (items: Item[], empty: string) => items.length === 0 ? <p className="muted">{empty}</p> : (
    <ul className="list">{items.map((t) => (
      <li key={t.id}><Link href={`/training/${t.id}`} className="item">
        <span className="item-main"><span className="item-title">{t.title}</span><span className="caption">{t.completedAt ? `Completed ${date(t.completedAt)}` : t.dueOn ? `Due ${day(t.dueOn)}` : "No deadline"}</span></span>
        <span className="row"><Tag meta={TRAINING_META[t.state]} /><ChevronRight className="chevron" aria-hidden="true" /></span>
      </Link></li>
    ))}</ul>
  );
  return (
    <Frame title="Training">
      <div className="stack">
        <div className="stack-sm"><h1>My training</h1><p className="muted">Courses assigned to you. Open one to read it and mark it done.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="card stack-sm" aria-labelledby="t-open"><h2 id="t-open">To do</h2>{list(open, "No training to do right now.")}</section>
            <section className="card stack-sm" aria-labelledby="t-done"><h2 id="t-done">Completed</h2>{list(done, "Nothing completed yet.")}</section>
          </>
        )}
      </div>
    </Frame>
  );
}
