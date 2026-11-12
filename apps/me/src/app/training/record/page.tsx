"use client";

import Link from "next/link";
import { Award, Download, Printer } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Section, Tag, useLoad } from "@/components/ui";
import { date } from "@/lib/format";
import { TRAINING_META } from "@/lib/meta";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

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
      <PageShell className="no-print-back" spacing="roomy" header={<PageHeader back={{ href: "/training", label: "My training" }} title="My training record" description={<>{data ? `${data.name} · ` : ""}every course you have had, with scores and certificates.</>} />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading rows={4} /> : (
          <>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <Button type="button" variant="outline" onClick={() => download(data)}><Download aria-hidden="true" />Download (Excel)</Button>
              <Button type="button" variant="outline" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</Button>
            </div>
            <Section id="record-done" title="Completed" aside={<p>{done.length} {done.length === 1 ? "course" : "courses"}</p>}>
              {done.length === 0 ? <EmptyRows>Nothing completed yet.</EmptyRows> : (
                <ul className="pc-list">{done.map((c) => (
                  <li key={c.id} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{c.title}</span>
                      <span className="pc-row-hint">{[`Completed ${date(c.completedAt)}`, c.signedOffBy ? `signed off by ${c.signedOffBy}` : null, c.exam ? `exam ${c.exam.best}%` : null, c.version ? `version ${c.version}` : null, c.grants ? `records ${c.grants}` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    {c.certificate ? <Button asChild variant="ghost" className="no-print"><Link href={`/training/${c.id}/certificate`}><Award aria-hidden="true" />Certificate</Link></Button> : null}
                  </li>
                ))}</ul>
              )}
            </Section>
            {open.length ? (
              <Section id="record-open" title="Still to finish" aside={<p>{open.length}</p>}>
                <ul className="pc-list">{open.map((c) => (
                  <li key={c.id}><Link href={`/training/${c.id}`} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{c.title}</span><span className="pc-row-hint">{[`Assigned ${date(c.assignedAt)} by ${c.assignedBy}`, c.dueOn ? `due ${date(c.dueOn)}` : null, c.exam ? `best exam ${c.exam.best}%` : null].filter(Boolean).join(" · ")}</span></span>
                    <Tag meta={TRAINING_META[c.state] ?? TRAINING_META.assigned} />
                  </Link></li>
                ))}</ul>
              </Section>
            ) : null}
            {data.paths.length ? (
              <Section id="record-paths" title="Learning paths">
                <ul className="pc-list">{data.paths.map((p) => (
                  <li key={`${p.title}-${p.startsOn}`} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{p.title}</span><span className="pc-row-hint tabular-nums">{p.finishedOn ? `Finished ${date(p.finishedOn)}` : `${p.done} of ${p.total} courses done`} · started {date(p.startsOn)}</span></span></li>
                ))}</ul>
              </Section>
            ) : null}
            {data.sessions.length ? (
              <Section id="record-sessions" title="Sessions attended">
                <ul className="pc-list">{data.sessions.map((s, i) => (
                  <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{s.title}</span><span className="pc-row-hint">{[s.when, s.trainer ? `with ${s.trainer}` : null, s.course ? `completes ${s.course}` : null].filter(Boolean).join(" · ")}</span></span></li>
                ))}</ul>
              </Section>
            ) : null}
            {data.hours.log.length || data.hours.progress.length ? (
              <Section id="record-hours" title="In-service hours" aside={<p>{inWords(minutes)} in all</p>}>
                {data.hours.progress.length ? <div className="me-section-note stack-sm">{data.hours.progress.map((h) => <span key={h.qualification} className="tabular"><strong>{h.qualification}</strong>: {inWords(h.minutes)} of {h.hours} h since {date(h.since)}{h.met ? ", done" : ""}</span>)}</div> : null}
                <ul className="pc-list">{data.hours.log.map((l, i) => (
                  <li key={i} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{inWords(l.minutes)} · {l.topic}</span><span className="pc-row-hint">{[date(l.on), l.qualification].filter(Boolean).join(" · ")}</span></span></li>
                ))}</ul>
              </Section>
            ) : null}
          </>
        )}
      </PageShell>
    </Frame>
  );
}
