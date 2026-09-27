import type { Metadata } from "next";
import { AssignTraining, CancelTraining } from "@/components/training/manage-actions";
import { QualificationStateTag, TrainingStatusTag } from "@/components/training/status";
import { formatDate } from "@/lib/format";
import { listCourses, personTraining } from "@/lib/training/data";

export const metadata: Metadata = { title: "Training record" };

/** One person's training and qualifications, for someone whose Training role
 *  covers them. Anyone else is a 404. */
export default async function TrainingPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await personTraining(id);
  const courses = data.canAssign ? (await listCourses()).courses : [];
  const person = { id: data.person.id, name: data.person.name, jobTitle: data.person.jobTitle };
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>{data.person.name}</h1>
          <p className="text-sm">{data.person.jobTitle || "Training record"}</p>
        </div>
        {data.canAssign && courses.length > 0 ? <AssignTraining courses={courses} people={[person]} userIds={[person.id]} /> : null}
      </div>
      <div className="module-columns">
        <section className="module-panel" aria-labelledby="training-history">
          <h2 id="training-history">Training</h2>
          {data.assignments.length === 0 ? <p className="text-sm text-ui-muted-foreground">No training assigned yet.</p> : (
            <ul>
              {data.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{a.course.title}</span><TrainingStatusTag state={a.state} /></div>
                    <p className="text-xs text-ui-muted-foreground">
                      {a.state === "completed" && a.completedAt
                        ? `Completed ${formatDate(a.completedAt)}${a.signedOffByName ? ` · signed off by ${a.signedOffByName}` : ""}`
                        : a.state === "cancelled" ? `Cancelled: ${a.cancelReason}`
                        : `Assigned by ${a.assignedByName} ${formatDate(a.assignedAt)} · ${a.dueOn ? `due ${formatDate(a.dueOn)}` : "no deadline"}`}
                    </p>
                    {a.signoffNote && a.state !== "cancelled" ? <p className="text-sm"><span className="font-semibold">Trainer: </span>{a.signoffNote}</p> : null}
                  </div>
                  {data.canAssign && (a.state === "assigned" || a.state === "overdue" || a.state === "submitted") ? <CancelTraining id={a.id} name={data.person.name} title={a.course.title} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="module-panel" aria-labelledby="training-qualifications">
          <h2 id="training-qualifications">Qualifications</h2>
          {data.qualifications.length === 0 ? <p className="text-sm text-ui-muted-foreground">None recorded.</p> : (
            <ul>
              {data.qualifications.map((q) => (
                <li key={q.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{q.type.name}</span><QualificationStateTag state={q.state} /></div>
                  <p className="text-xs text-ui-muted-foreground">Issued {formatDate(q.issuedOn)}{q.expiresOn ? ` · expires ${formatDate(q.expiresOn)}` : " · does not expire"}{q.reference ? ` · ${q.reference}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
