"use client";

import Link from "next/link";
import { BookmarkCheck, ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, useLoad } from "@/components/ui";
import { date } from "@/lib/format";

type Saved = { items: { assignmentId: string; lessonId: string; course: string; section: string; title: string; bookmarked: boolean; note: string; updatedAt: string }[] };

/** Lessons you bookmarked or wrote a note on (Training e-learning phase 6). Only you see these. */
export default function SavedPage() {
  const { data, error, reload } = useLoad<Saved>("training/saved");
  return (
    <Frame title="Saved">
      <div className="stack">
        <Link href="/training" className="button ghost back-link"><ChevronLeft aria-hidden="true" />My training</Link>
        <div className="stack-sm"><h1>Saved</h1><p className="muted">Lessons you bookmarked or wrote a note on. Only you can see these.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <section className="pc-panel" aria-label="Saved lessons">
            {data.items.length === 0 ? <EmptyRows>Nothing saved yet. Tap Bookmark on a lesson, or write a note under it.</EmptyRows> : (
              <ul className="pc-rows">{data.items.map((n) => (
                <li key={`${n.assignmentId}-${n.lessonId}`}><Link href={`/training/${n.assignmentId}/${n.lessonId}`} className="pc-row">
                  <span className="pc-tile-icon">{n.bookmarked ? <BookmarkCheck aria-hidden="true" /> : <NotebookPen aria-hidden="true" />}</span>
                  <span className="pc-row-body stack-sm">
                    <span><span className="caption">{[n.course, n.section].filter(Boolean).join(" › ")}</span><br /><span className="pc-row-title">{n.title}</span></span>
                    {n.note ? <span className="note-text">{n.note}</span> : null}
                    <span className="pc-row-hint">{[n.bookmarked ? "Bookmarked" : null, n.note ? "Your note" : null].filter(Boolean).join(" · ")} · {date(n.updatedAt)}</span>
                  </span>
                  <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                </Link></li>
              ))}</ul>
            )}
          </section>
        )}
      </div>
    </Frame>
  );
}
