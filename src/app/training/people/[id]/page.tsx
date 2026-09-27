import type { Metadata } from "next";
import { Card } from "@/components/shadcn/card";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
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
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href="/training" current={data.person.name}>Training</BackLink>
      <PageHeader
        title={data.person.name}
        description={data.person.jobTitle || "Training record"}
        actions={data.canAssign && courses.length > 0 ? <AssignTraining courses={courses} people={[person]} userIds={[person.id]} /> : null}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <Card className="gap-3 p-5 shadow-none" aria-labelledby="training-history">
          <h2 id="training-history" className="text-lg font-semibold">Training</h2>
          {data.assignments.length === 0 ? <p className="text-sm text-ui-muted-foreground">No training assigned yet.</p> : (
            <ul className="divide-y divide-ui-border">
              {data.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{a.course.title}</span><TrainingStatusTag state={a.state} /></div>
                    <p className="text-xs text-ui-muted-foreground">
                      {a.state === "completed" && a.completedAt
                        ? `Completed ${formatDate(a.completedAt)}${a.signedOffByName ? ` · signed off by ${a.signedOffByName}` : ""}`
                        : a.state === "cancelled" ? `Cancelled: ${a.cancelReason}`
                        : `Assigned by ${a.assignedByName} ${formatDate(a.assignedAt)} · ${a.dueOn ? `due ${formatDate(a.dueOn)}` : "no deadline"}`}
                    </p>
                    {a.signoffNote && a.state !== "cancelled" ? <p className="text-sm"><span className="font-medium">Trainer: </span>{a.signoffNote}</p> : null}
                  </div>
                  {data.canAssign && (a.state === "assigned" || a.state === "overdue" || a.state === "submitted") ? <CancelTraining id={a.id} name={data.person.name} title={a.course.title} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="gap-3 p-5 shadow-none" aria-labelledby="training-qualifications">
          <h2 id="training-qualifications" className="text-lg font-semibold">Qualifications</h2>
          {data.qualifications.length === 0 ? <p className="text-sm text-ui-muted-foreground">None recorded.</p> : (
            <ul className="divide-y divide-ui-border">
              {data.qualifications.map((q) => (
                <li key={q.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{q.type.name}</span><QualificationStateTag state={q.state} /></div>
                  <p className="text-xs text-ui-muted-foreground">Issued {formatDate(q.issuedOn)}{q.expiresOn ? ` · expires ${formatDate(q.expiresOn)}` : " · does not expire"}{q.reference ? ` · ${q.reference}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
