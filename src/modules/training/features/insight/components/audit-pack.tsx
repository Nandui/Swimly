import type { ReactNode } from "react";
import { Tag } from "@/components/ui-kit/tag";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { PLACE_STATUS_META, TRAINING_STATUS_META } from "@/modules/training/shared/constants";
import { hoursInWords } from "@/modules/training/shared/on-the-job";
import type { CourseAuditPack, PersonAuditPack } from "@/modules/training/features/insight/server/data";

const RESULT_WORDS = { met: "Met", "not-yet": "Not yet", na: "Not needed" } as const;

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="pc-panel break-inside-avoid">
      <div className="space-y-1">
        <h2 id={id}>{title}</h2>
        {hint ? <p className="text-sm text-ui-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Label and value pairs, in two or three columns where there is room. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 space-y-1">
          <dt className="text-xs font-semibold tracking-wide text-ui-muted-foreground uppercase">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line">{value || "None"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Trail({ rows }: { rows: { id: string; createdAt: Date; actorName: string; summary: string; about: string }[] }) {
  if (!rows.length) return <p className="text-sm text-ui-muted-foreground">Nothing recorded.</p>;
  return (
    <Table>
      <TableCaption className="sr-only">Every change recorded, oldest first</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="p-3">When</TableHead>
          <TableHead scope="col" className="p-3">Who</TableHead>
          <TableHead scope="col" className="p-3">About</TableHead>
          <TableHead scope="col" className="p-3">What happened</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="p-3 text-sm whitespace-nowrap tabular-nums">{formatDateTime(t.createdAt)}</TableCell>
            <TableCell className="p-3 text-sm">{t.actorName}</TableCell>
            <TableCell className="p-3 text-sm">{t.about}</TableCell>
            <TableCell className="p-3 text-sm whitespace-normal">{t.summary}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const score = (a: { percent: number | null; correct?: number | null; total?: number }) => (a.percent === null ? "Not handed in" : `${a.percent}%${a.correct != null && a.total ? ` (${a.correct} of ${a.total})` : ""}`);

/** Everything Training holds on one person, laid out to print or save as a PDF for an inspector,
 *  an insurer or after an incident (e-learning phase 7). */
export function PersonAuditPackView({ data }: { data: PersonAuditPack }) {
  return (
    <div className="flex flex-col gap-6">
      <Section id="pack-who" title="About this record">
        <Facts rows={[
          ["Person", data.person.name], ["Job", data.person.jobTitle ?? ""], ["Sites", data.person.sites],
          ["Made", formatDateTime(data.generatedAt)], ["Made by", data.who.name], ["Courses on record", String(data.courses.length)],
        ]} />
      </Section>

      <Section id="pack-qualifications" title="Qualifications">
        {data.qualifications.length ? (
          <ul className="pc-rows">
            {data.qualifications.map((q) => (
              <li key={q.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{q.type.name}</span>
                  <span className="pc-row-hint tabular-nums">
                    {[q.issuedOn ? `Issued ${formatDate(q.issuedOn)}` : null, q.expiresOn ? `runs out ${formatDate(q.expiresOn)}` : "does not run out", q.reference ? `reference ${q.reference}` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Tag meta={QUALIFICATION_STATE_META[q.state]} />
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ui-muted-foreground">None recorded.</p>}
      </Section>

      {data.courses.map((c, i) => (
        <Section key={c.id} id={`pack-course-${i}`} title={c.title}>
          <div><Tag meta={TRAINING_STATUS_META[c.state]} /></div>
          <Facts rows={[
            ["Given", `${formatDate(c.assignedAt)} by ${c.assignedByName}`],
            ["Due", c.dueOn ? formatDate(c.dueOn) : "No due date"],
            ["Version taught", c.version ? `Version ${c.version.number}, published ${formatDate(c.version.publishedAt)}` : "The course text before versions"],
            ["Handed in", c.submittedAt ? formatDateTime(c.submittedAt) : ""],
            ["Completed", c.completedAt ? formatDateTime(c.completedAt) : ""],
            ["Certificate code", c.certificateCode ?? ""],
            ...(c.cancelledAt ? [["Cancelled", `${formatDate(c.cancelledAt)}${c.cancelReason ? `: ${c.cancelReason}` : ""}`] as [string, string]] : []),
            ...(c.signedOffByName ? [["Practical signed off by", `${c.signedOffByName}${c.signoffNote ? `: ${c.signoffNote}` : ""}`] as [string, string]] : []),
          ]} />
          {c.lessons.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Lessons finished · {c.lessons.length}</h3>
              <ol className="grid gap-1 text-sm sm:grid-cols-2">
                {c.lessons.map((l, n) => <li key={n} className="min-w-0 break-words"><span className="tabular-nums text-ui-muted-foreground">{formatDateTime(l.at)}</span> · {l.title}</li>)}
              </ol>
            </div>
          ) : null}
          {c.attempts.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Final exam</h3>
              <ul className="grid gap-1 text-sm">
                {c.attempts.map((a) => (
                  <li key={a.number} className="tabular-nums">
                    Sitting {a.number}: {score(a)}{a.passed === null ? "" : a.passed ? ", passed" : ", not passed"}{a.submittedAt ? ` · ${formatDateTime(a.submittedAt)}` : ` · started ${formatDateTime(a.startedAt)}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {c.observation ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Practical checklist · {c.observation.observedByName}, {formatDate(new Date(c.observation.observedAt))}</h3>
              <ul className="grid gap-1 text-sm">
                {c.observation.steps.map((s) => <li key={s.id}>{RESULT_WORDS[s.result]}: {s.text}{s.critical ? " (must be met)" : ""}{s.note ? `. ${s.note}` : ""}</li>)}
              </ul>
            </div>
          ) : null}
          {c.evidence.length ? <p className="text-sm">Evidence kept: {c.evidence.map((e) => `${e.name} (${formatDate(e.createdAt)})`).join(", ")}</p> : null}
        </Section>
      ))}

      {data.hours.progress.length || data.hours.log.length ? (
        <Section id="pack-hours" title="In-service hours" hint="The latest 30 entries.">
          {data.hours.progress.map((p) => <p key={p.typeId} className="text-sm">{p.typeName}: {hoursInWords(p.minutes)} of {p.hours} hours{p.met ? ", target met" : ""}.</p>)}
          <ul className="grid gap-1 text-sm">
            {data.hours.log.map((l) => <li key={l.id} className="tabular-nums">{formatDate(l.on)} · {hoursInWords(l.minutes)} · {l.topic}{l.typeName ? ` · ${l.typeName}` : ""} · recorded by {l.recordedByName}</li>)}
          </ul>
        </Section>
      ) : null}

      {data.sessions.length ? (
        <Section id="pack-sessions" title="Sessions">
          <ul className="grid gap-1 text-sm">
            {data.sessions.map((s) => <li key={s.id}>{s.when} · {s.title}{s.course ? ` (${s.course})` : ""} · {PLACE_STATUS_META[s.status as keyof typeof PLACE_STATUS_META]?.label ?? s.status} · trainer {s.trainerName}</li>)}
          </ul>
        </Section>
      ) : null}

      <section aria-labelledby="pack-trail" className="pc-panel break-inside-avoid">
        <div className="space-y-1"><h2 id="pack-trail">Audit trail</h2><p className="text-sm text-ui-muted-foreground">Every change to this person’s training and qualifications, oldest first.</p></div>
        <Trail rows={data.trail} />
      </section>
    </div>
  );
}

/** A course's record for an inspector: its versions and what changed, who must take it, and every
 *  person the reader covers who was given it, with the version taught and the result. */
export function CourseAuditPackView({ data }: { data: CourseAuditPack }) {
  return (
    <div className="flex flex-col gap-6">
      <Section id="pack-course" title="About this record">
        <Facts rows={[
          ["Course", data.course.title], ["Made", formatDateTime(data.generatedAt)], ["Made by", data.who.name],
          ["Who must take it", data.rule ? `${data.rule.audience}${data.rule.paused ? " (rule paused)" : ""}` : "No training rule: given by hand"],
          ["How often", data.rule?.timing ?? ""], ["Practical sign-off", data.course.requiresSignoff ? "Needed" : "Not needed"],
        ]} />
      </Section>

      <Section id="pack-versions" title="Versions" hint="Each version is frozen when published; people keep the one they started.">
        {data.versions.length ? (
          <ul className="pc-rows">
            {data.versions.map((v) => (
              <li key={v.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">Version {v.number}</span>
                  <span className="pc-row-hint">{formatDateTime(v.publishedAt)} by {v.publishedByName} · {v.lessonCount} {v.lessonCount === 1 ? "lesson" : "lessons"}{v.retake ? " · retake asked" : ""}{v.changeNote ? ` · ${v.changeNote}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ui-muted-foreground">Never published.</p>}
      </Section>

      <section aria-labelledby="pack-learners" className="pc-panel break-inside-avoid">
        <div className="space-y-1"><h2 id="pack-learners">People · {data.learners.length}</h2><p className="text-sm text-ui-muted-foreground">Everyone you cover who was given it, cancelled training included.</p></div>
        {data.learners.length ? (
          <Table>
            <TableCaption className="sr-only">Each person given this course, the version taught and their result</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="p-3">Person</TableHead>
                <TableHead scope="col" className="p-3">Status</TableHead>
                <TableHead scope="col" className="p-3">Version</TableHead>
                <TableHead scope="col" className="p-3">Given</TableHead>
                <TableHead scope="col" className="p-3">Completed</TableHead>
                <TableHead scope="col" className="p-3">Exam</TableHead>
                <TableHead scope="col" className="p-3">Signed off by</TableHead>
                <TableHead scope="col" className="p-3">Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.learners.map((l) => (
                <TableRow key={l.id}>
                  <TableHead scope="row" className="h-auto p-3 font-medium">{l.name}<span className="block text-xs font-normal text-ui-muted-foreground">{l.sites}</span></TableHead>
                  <TableCell className="p-3"><Tag meta={TRAINING_STATUS_META[l.state]} /></TableCell>
                  <TableCell className="p-3 tabular-nums">{l.version ?? "–"}</TableCell>
                  <TableCell className="p-3 text-sm tabular-nums">{formatDate(l.assignedAt)}</TableCell>
                  <TableCell className="p-3 text-sm tabular-nums">{l.completedAt ? formatDate(l.completedAt) : "–"}</TableCell>
                  <TableCell className="p-3 text-sm tabular-nums">{l.best === null ? "–" : `${l.best}%`}{l.attempts > 1 ? ` · ${l.attempts} sittings` : ""}</TableCell>
                  <TableCell className="p-3 text-sm">{l.signedOffByName ?? "–"}</TableCell>
                  <TableCell className="p-3 font-mono text-sm">{l.certificateCode ?? "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-ui-muted-foreground">Nobody you cover was given it.</p>}
      </section>

      <section aria-labelledby="pack-trail" className="pc-panel break-inside-avoid">
        <div className="space-y-1"><h2 id="pack-trail">Audit trail</h2><p className="text-sm text-ui-muted-foreground">Changes to the course and to these people’s training on it, oldest first.</p></div>
        <Trail rows={data.trail} />
      </section>
    </div>
  );
}
