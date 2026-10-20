import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { AssignTraining, CancelTraining, GiveExamAttempt, listCourses, personTraining, TRAINING_STATUS_META } from "@/modules/training/features/assignments";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { formatDate } from "@/lib/format";
import { AuthorizationError } from "@/lib/authz";
import { Progress } from "@/components/shadcn/progress";
import { hoursInWords, hoursOf } from "@/modules/training/features/hours";
import { pathsOf } from "@/modules/training/features/paths";
import { PLACE_STATUS_META, sessionsOf } from "@/modules/training/features/sessions";

/** One read per request, shared by the page and its tab title. personTraining
 *  is the guard: it 404s anyone the reader's Training role does not cover. */
const load = cache(personTraining);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    return { title: (await load((await params).id)).person.name };
  } catch (error) {
    // No Training access: the layout turns the page into a 404, so the title is the 404 page's.
    if (error instanceof AuthorizationError) return { title: "Page not found" };
    throw error;
  }
}

/** One person's training and qualifications, for someone whose Training role
 *  covers them. Anyone else is a 404. */
export default async function TrainingPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  // personTraining (above) has checked the reader covers this person.
  const [courses, hours, sessions, paths] = await Promise.all([
    data.canAssign ? listCourses().then((r) => r.courses) : Promise.resolve([]),
    hoursOf(id, data.who.orgId), sessionsOf(id), pathsOf(id),
  ]);
  const person = { id: data.person.id, name: data.person.name, jobTitle: data.person.jobTitle };
  return (
    <PageShell header={<PageHeader
        back={{ href: "/training", label: "People" }}
        title={data.person.name}
        description={data.person.jobTitle || "Training record"}
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11"><Link href={`/training/people/${id}/audit`}><FileText aria-hidden="true" />Audit pack</Link></Button>
            {data.canAssign && courses.length > 0 ? <AssignTraining courses={courses} people={[person]} userIds={[person.id]} /> : null}
          </>
        }
      />}>
      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="training-history">
          <div className="pc-panel-head"><h2 id="training-history">Training</h2></div>
          {data.assignments.length === 0 ? <EmptyState compact icon="graduation" title="No training assigned yet" /> : (
            <ul className="pc-rows">
              {data.assignments.map((a) => (
                <li key={a.id} className="pc-row">
                  <div className="pc-row-body">
                    <span className="pc-row-title">{a.course.title}</span>
                    <p className="pc-row-hint">
                      {a.state === "completed" && a.completedAt
                        ? `Completed ${formatDate(a.completedAt)}${a.signedOffByName ? ` · signed off by ${a.signedOffByName}` : ""}`
                        : a.state === "cancelled" ? `Cancelled: ${a.cancelReason}`
                        : `Assigned by ${a.assignedByName} ${formatDate(a.assignedAt)} · ${a.dueOn ? `due ${formatDate(a.dueOn)}` : "no deadline"}`}
                    </p>
                    {a.signoffNote && a.state !== "cancelled" ? <p className="pc-row-hint">Trainer: {a.signoffNote}</p> : null}
                    {a.observation ? (
                      <p className="pc-row-hint">
                        Practical, observed by {a.observation.observedByName}: {a.observation.steps.filter((t) => t.result === "met").length} of {a.observation.steps.length} met
                        {a.observation.steps.some((t) => t.result === "not-yet") ? ` · to practise: ${a.observation.steps.filter((t) => t.result === "not-yet").map((t) => t.text).join("; ")}` : ""}
                      </p>
                    ) : null}
                    {a.evidence.length ? (
                      <p className="pc-row-hint">
                        Photos: {a.evidence.map((e, i) => <a key={e.id} href={`/training/evidence/${e.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-1 underline underline-offset-4">{i + 1}</a>)}
                      </p>
                    ) : null}
                    {a.exam && a.exam.attempts.length ? (
                      <p className="pc-row-hint tabular">
                        Exam (pass mark {a.exam.passMark}%): {a.exam.attempts.map((t) => `${t.percent ?? 0}%${t.passed ? " passed" : ""}`).join(", ")}
                        {a.exam.passed ? "" : ` · ${a.exam.attempts.length} of ${a.exam.allowed} attempts used`}
                      </p>
                    ) : null}
                  </div>
                  <div className="pc-row-trail">
                    <Tag meta={TRAINING_STATUS_META[a.state]} />
                    {data.canAssign && (a.state === "assigned" || a.state === "overdue" || a.state === "submitted") ? <CancelTraining id={a.id} name={data.person.name} title={a.course.title} /> : null}
                    {data.canAssign && a.exam?.outOfAttempts && (a.state === "assigned" || a.state === "overdue") ? <GiveExamAttempt id={a.id} name={data.person.name} title={a.course.title} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {paths.length ? (
          <section className="pc-panel" aria-labelledby="training-paths">
            <div className="pc-panel-head"><h2 id="training-paths">Learning paths</h2></div>
            <ul className="pc-rows">
              {paths.map((p) => (
                <li key={p.id} className="pc-row">
                  <div className="pc-row-body">
                    <Link href={`/training/paths/${p.pathId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{p.title}</Link>
                    <p className="pc-row-hint tabular-nums">Started {formatDate(p.startsOn)} · {p.done} of {p.total} done{p.finishedOn ? ` · finished ${formatDate(p.finishedOn)}` : p.overdue ? " · behind" : ""}</p>
                  </div>
                  <div className="pc-row-trail min-w-(--pc-tile-min)"><Progress value={p.total ? Math.round((p.done / p.total) * 100) : 0} aria-label={`${p.done} of ${p.total} courses done`} /></div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {hours.progress.length || hours.log.length ? (
          <section className="pc-panel" aria-labelledby="training-hours">
            <div className="pc-panel-head"><h2 id="training-hours">In-service hours</h2></div>
            {hours.progress.length ? (
              <ul className="pc-rows">
                {hours.progress.map((h) => (
                  <li key={h.typeId} className="pc-row flex-wrap">
                    <div className="pc-row-body">
                      <span className="pc-row-title">{h.typeName}</span>
                      <p className="pc-row-hint tabular-nums">{hoursInWords(h.minutes)} of {h.hours} h since {formatDate(h.since)}{h.met ? " · done" : ` · ${hoursInWords(h.needed - h.minutes)} to go`}</p>
                    </div>
                    <div className="pc-row-trail min-w-(--pc-tile-min)"><Progress value={h.percent} aria-label={`${h.percent}% of the hours for ${h.typeName}`} /></div>
                  </li>
                ))}
              </ul>
            ) : null}
            {hours.log.length ? (
              <ul className="pc-rows" aria-label="Hours logged">
                {hours.log.slice(0, 10).map((l) => (
                  <li key={l.id} className="pc-row">
                    <div className="pc-row-body">
                      <span className="pc-row-title">{hoursInWords(l.minutes)} · {l.topic}</span>
                      <p className="pc-row-hint">{formatDate(l.on)}{l.typeName ? ` · ${l.typeName}` : " · general"} · logged by {l.recordedByName}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
        {sessions.length ? (
          <section className="pc-panel" aria-labelledby="training-sessions">
            <div className="pc-panel-head"><h2 id="training-sessions">Sessions</h2></div>
            <ul className="pc-rows">
              {sessions.map((x) => (
                <li key={x.id} className="pc-row">
                  <div className="pc-row-body">
                    <Link href={`/training/sessions/${x.id}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{x.title}</Link>
                    <p className="pc-row-hint tabular-nums">{x.when}{x.location ? ` · ${x.location}` : ""}</p>
                  </div>
                  <div className="pc-row-trail"><Tag meta={PLACE_STATUS_META[x.status as keyof typeof PLACE_STATUS_META] ?? PLACE_STATUS_META.BOOKED} /></div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="pc-panel" aria-labelledby="training-qualifications">
          <div className="pc-panel-head"><h2 id="training-qualifications">Qualifications</h2></div>
          {data.qualifications.length === 0 ? <EmptyState compact icon="award" title="No qualifications recorded" /> : (
            <ul className="pc-rows">
              {data.qualifications.map((q) => (
                <li key={q.id} className="pc-row">
                  <div className="pc-row-body">
                    <span className="pc-row-title">{q.type.name}</span>
                    <p className="pc-row-hint">{q.issuedOn ? `Issued ${formatDate(q.issuedOn)}` : "No issue date"}{q.expiresOn ? ` · expires ${formatDate(q.expiresOn)}` : " · does not expire"}{q.reference ? ` · ${q.reference}` : ""}</p>
                  </div>
                  <div className="pc-row-trail"><Tag meta={QUALIFICATION_STATE_META[q.state]} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
