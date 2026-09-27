"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { clock, day } from "@/lib/format";
import { QUALIFICATION_META, READING_META, SHIFT_WARNING_META, TRAINING_META } from "@/lib/meta";

type Home = {
  name: string;
  training: { id: string; title: string; state: string; dueOn: string | null }[];
  reading: { documentId: string; title: string; dueOn: string | null; overdue: boolean }[];
  qualifications: { id: string; name: string; expiresOn: string | null; state: string }[];
  shifts: { id: string; date: string; startMinutes: number; endMinutes: number; role: string; site: string; warnings: string[] }[];
  reviewsToAcknowledge: number;
};

/** What needs you, then your next shifts. Nothing from HR beyond a count. */
export default function HomePage() {
  const { data, error, reload } = useLoad<Home>("home");
  const todo = data ? data.training.filter((t) => t.state !== "submitted").length + data.reading.length + data.reviewsToAcknowledge + data.qualifications.length : 0;
  return (
    <Frame title="Home">
      {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
        <div className="stack">
          <div className="stack-sm">
            <h1>Hello, {data.name.split(" ")[0]}</h1>
            <p className="muted">{todo === 0 ? "Nothing needs you right now." : `${todo} ${todo === 1 ? "thing needs" : "things need"} you.`}</p>
          </div>

          {data.reviewsToAcknowledge > 0 ? (
            <Link href="/hr" className="card item" style={{ padding: "16px 20px" }}>
              <span className="item-main"><span className="item-title">A review was shared with you</span><span className="caption">Open HR to read and acknowledge it. You’ll need a fresh code.</span></span>
              <ChevronRight className="chevron" aria-hidden="true" />
            </Link>
          ) : null}

          <section className="card stack-sm" aria-labelledby="home-training">
            <div className="spread"><h2 id="home-training">Training</h2><Link href="/training">All training</Link></div>
            {data.training.length === 0 ? <p className="muted">No training to do.</p> : (
              <ul className="list">{data.training.map((t) => (
                <li key={t.id}><Link href={`/training/${t.id}`} className="item">
                  <span className="item-main"><span className="item-title">{t.title}</span><span className="caption">{t.dueOn ? `Due ${day(t.dueOn)}` : "No deadline"}</span></span>
                  <span className="row"><Tag meta={TRAINING_META[t.state]} /><ChevronRight className="chevron" aria-hidden="true" /></span>
                </Link></li>
              ))}</ul>
            )}
          </section>

          <section className="card stack-sm" aria-labelledby="home-reading">
            <div className="spread"><h2 id="home-reading">Required reading</h2><Link href="/reading">All reading</Link></div>
            {data.reading.length === 0 ? <p className="muted">Nothing to read.</p> : (
              <ul className="list">{data.reading.map((r) => (
                <li key={r.documentId}><Link href={`/reading/${r.documentId}`} className="item">
                  <span className="item-main"><span className="item-title">{r.title}</span><span className="caption">{r.dueOn ? `Due ${day(r.dueOn)}` : "No deadline"}</span></span>
                  <span className="row"><Tag meta={r.overdue ? READING_META.overdue : READING_META.outstanding} /><ChevronRight className="chevron" aria-hidden="true" /></span>
                </Link></li>
              ))}</ul>
            )}
          </section>

          {data.qualifications.length > 0 ? (
            <section className="card stack-sm" aria-labelledby="home-quals">
              <div className="spread"><h2 id="home-quals">Qualifications</h2><Link href="/qualifications">All</Link></div>
              <ul className="list">{data.qualifications.map((q) => (
                <li key={q.id} className="item">
                  <span className="item-main"><span className="item-title">{q.name}</span><span className="caption">{q.state === "expired" ? "Expired" : "Expires"} {day(q.expiresOn)}</span></span>
                  <Tag meta={QUALIFICATION_META[q.state]} />
                </li>
              ))}</ul>
            </section>
          ) : null}

          <section className="card stack-sm" aria-labelledby="home-shifts">
            <div className="spread"><h2 id="home-shifts">Next shifts</h2><Link href="/shifts">All shifts</Link></div>
            {data.shifts.length === 0 ? <p className="muted">No shifts in the next week.</p> : (
              <ul className="list">{data.shifts.map((s) => (
                <li key={s.id} className="item">
                  <span className="item-main"><span className="item-title">{day(s.date)} · {clock(s.startMinutes)}–{clock(s.endMinutes)}</span><span className="caption">{s.role} at {s.site}</span></span>
                  {s.warnings[0] ? <Tag meta={SHIFT_WARNING_META[s.warnings[0]]} /> : null}
                </li>
              ))}</ul>
            )}
          </section>
        </div>
      )}
    </Frame>
  );
}
