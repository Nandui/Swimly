"use client";

import Link from "next/link";
import { Award, ChevronLeft, Download, Printer } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { date } from "@/lib/format";
import { TRAINING_META } from "@/lib/meta";

type MyRecord = {
  name: string;
  courses: { id: string; title: string; category: string; state: string; assignedAt: string; assignedBy: string; dueOn: string | null; completedAt: string | null; signedOffBy: string | null;
    grants: string | null; version: number | null; exam: { attempts: number; best: number; passed: boolean } | null; certificate: boolean }[];
  sessions: { title: string; when: string; course: string | null; trainer: string }[];
  paths: { title: string; startsOn: string; done: number; total: number; finishedOn: string | null }[];
  hours: { progress: { qualification: string; hours: number; windowMonths: number; minutes: number; since: string; met: boolean }[]; log: { on: string; minutes: number; topic: string; qualification: string | null }[] };
};

const inWords = (minutes: number) => { const h = Math.floor(minutes / 60), m = minutes % 60; return [h ? `${h} h` : null, m || !h ? `${m} min` : null].filter(Boolean).join(" "); };
const cell = (value: string | number | null | undefined) => { const text = String(value ?? ""); return /[",\n]/.test(text) || /^[=+\-@]/.test(text) ? `"${text.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : text; };

/** The record as a spreadsheet file, made on the phone: nothing extra is sent. */
function download(record: MyRecord) {
  const rows = [
    ["Course", "Category", "Status", "Assigned", "Due", "Completed", "Signed off by", "Version", "Best exam score", "Records"],
    ...record.courses.map((c) => [c.title, c.category, TRAINING_META[c.state]?.label ?? c.state, date(c.assignedAt), date(c.dueOn), date(c.completedAt), c.signedOffBy ?? "",
      c.version ?? "", c.exam ? `${c.exam.best}%` : "", c.grants ?? ""]),
    [],
    ["In-service hours", "Date", "Time", "Qualification"],
    ...record.hours.log.map((l) => [l.topic, date(l.on), inWords(l.minutes), l.qualification ?? ""]),
    [],
    ["Session attended", "When", "Course", "Trainer"],
    ...record.sessions.map((s) => [s.title, s.when, s.course ?? "", s.trainer]),
  ];
  const blob = new Blob([`﻿${rows.map((r) => r.map(cell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `My training record ${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** My record (Training e-learning phase 6): every course, score and
 *  certificate, sessions and hours, to keep, print or download. */
export default function RecordPage() {
  const { data, error, reload } = useLoad<MyRecord>("training/record");
  const done = data?.courses.filter((c) => c.state === "completed") ?? [];
  const open = data?.courses.filter((c) => c.state !== "completed") ?? [];
  const minutes = data?.hours.log.reduce((n, l) => n + l.minutes, 0) ?? 0;
  return (
    <Frame title="My record">
      <div className="stack">
        <Link href="/training" className="button ghost back-link no-print"><ChevronLeft aria-hidden="true" />My training</Link>
        <div className="stack-sm"><h1>My training record</h1><p className="muted">{data ? `${data.name} · ` : ""}every course you have had, with scores and certificates.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading rows={4} /> : (
          <>
            <div className="row no-print">
              <button type="button" className="button outline" onClick={() => download(data)}><Download aria-hidden="true" />Download (Excel)</button>
              <button type="button" className="button outline" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</button>
            </div>
            <section className="pc-panel" aria-labelledby="record-done">
              <div className="pc-panel-head"><h2 id="record-done">Completed</h2><span className="muted tabular">{done.length} {done.length === 1 ? "course" : "courses"}</span></div>
              {done.length === 0 ? <EmptyRows>Nothing completed yet.</EmptyRows> : (
                <ul className="pc-rows">{done.map((c) => (
                  <li key={c.id} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{c.title}</span>
                      <span className="pc-row-hint">{[`Completed ${date(c.completedAt)}`, c.signedOffBy ? `signed off by ${c.signedOffBy}` : null, c.exam ? `exam ${c.exam.best}%` : null, c.version ? `version ${c.version}` : null, c.grants ? `records ${c.grants}` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    {c.certificate ? <Link href={`/training/${c.id}/certificate`} className="button ghost no-print"><Award aria-hidden="true" />Certificate</Link> : null}
                  </li>
                ))}</ul>
              )}
            </section>
            {open.length ? (
              <section className="pc-panel" aria-labelledby="record-open">
                <h2 id="record-open">Still to finish</h2>
                <ul className="pc-rows">{open.map((c) => (
                  <li key={c.id}><Link href={`/training/${c.id}`} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{c.title}</span><span className="pc-row-hint">{[`Assigned ${date(c.assignedAt)} by ${c.assignedBy}`, c.dueOn ? `due ${date(c.dueOn)}` : null, c.exam ? `best exam ${c.exam.best}%` : null].filter(Boolean).join(" · ")}</span></span>
                    <Tag meta={TRAINING_META[c.state] ?? TRAINING_META.assigned} />
                  </Link></li>
                ))}</ul>
              </section>
            ) : null}
            {data.paths.length ? (
              <section className="pc-panel" aria-labelledby="record-paths">
                <h2 id="record-paths">Learning paths</h2>
                <ul className="pc-rows">{data.paths.map((p) => (
                  <li key={`${p.title}-${p.startsOn}`} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{p.title}</span><span className="pc-row-hint tabular">{p.finishedOn ? `Finished ${date(p.finishedOn)}` : `${p.done} of ${p.total} courses done`} · started {date(p.startsOn)}</span></span></li>
                ))}</ul>
              </section>
            ) : null}
            {data.sessions.length ? (
              <section className="pc-panel" aria-labelledby="record-sessions">
                <h2 id="record-sessions">Sessions attended</h2>
                <ul className="pc-rows">{data.sessions.map((s, i) => (
                  <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{s.title}</span><span className="pc-row-hint">{[s.when, s.trainer ? `with ${s.trainer}` : null, s.course ? `completes ${s.course}` : null].filter(Boolean).join(" · ")}</span></span></li>
                ))}</ul>
              </section>
            ) : null}
            {data.hours.log.length || data.hours.progress.length ? (
              <section className="pc-panel stack-sm" aria-labelledby="record-hours">
                <h2 id="record-hours">In-service hours</h2>
                {data.hours.progress.map((h) => <p key={h.qualification} className="tabular"><strong>{h.qualification}</strong>: {inWords(h.minutes)} of {h.hours} h since {date(h.since)}{h.met ? ", done" : ""}</p>)}
                <p className="muted tabular">{inWords(minutes)} logged in all</p>
                <ul className="pc-rows">{data.hours.log.map((l, i) => (
                  <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{inWords(l.minutes)} · {l.topic}</span><span className="pc-row-hint">{[date(l.on), l.qualification].filter(Boolean).join(" · ")}</span></span></li>
                ))}</ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Frame>
  );
}
