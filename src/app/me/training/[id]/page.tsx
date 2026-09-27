import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Notice } from "@/components/ui-kit/notice";
import { PortalFrame } from "@/components/portal/portal-frame";
import { CompleteTraining } from "@/components/training/learner-actions";
import { TrainingStatusTag } from "@/components/training/status";
import { formatDate } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { myAssignment } from "@/lib/training/mine";

export const metadata: Metadata = { title: { absolute: "Training · Turnfin" } };

/** One of the signed-in person's own courses. Anyone else's id is a 404. */
export default async function MyTrainingCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await pageSession();
  const { id } = await params;
  const row = await myAssignment(id);
  const course = row.course;
  const facts = [
    `Assigned by ${row.assignedByName} on ${formatDate(row.assignedAt)}`,
    row.dueOn ? `due ${formatDate(row.dueOn)}` : null,
    course.requiresSignoff ? "a trainer signs this off in person" : null,
    course.grantsType ? `records your ${course.grantsType.name}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <PortalFrame userName={session.user.name ?? "Staff member"} moduleName="My training">
      <div className="space-y-3">
        <Button asChild variant="ghost" className="-ml-3 min-h-11"><Link href="/me/training"><ArrowLeft aria-hidden="true" />My training</Link></Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
          <TrainingStatusTag state={row.state} />
        </div>
        {course.summary ? <p className="text-ui-muted-foreground">{course.summary}</p> : null}
        <p className="text-sm text-ui-muted-foreground">{facts}</p>
      </div>

      {row.state === "submitted" ? (
        <Notice tone="info" title="Waiting for sign-off" description="A trainer will watch you do it and sign it off. There is nothing else to do here." />
      ) : row.state === "completed" && row.completedAt ? (
        <Notice tone="info" title={`Completed ${formatDate(row.completedAt)}`} description={row.signedOffByName ? `Signed off by ${row.signedOffByName}.${row.signoffNote ? ` ${row.signoffNote}` : ""}` : undefined} />
      ) : row.signoffNote ? (
        <Notice tone="warning" title={`Not signed off yet${row.signedOffByName ? ` by ${row.signedOffByName}` : ""}`} description={row.signoffNote} />
      ) : null}

      <Card className="gap-3 p-5 shadow-none" aria-labelledby="material">
        <h2 id="material" className="text-lg font-semibold">What to do</h2>
        {course.content
          ? <div className="max-w-prose whitespace-pre-wrap break-words">{course.content}</div>
          : <p className="text-sm text-ui-muted-foreground">Your trainer will go through this with you.</p>}
      </Card>

      {row.state === "assigned" || row.state === "overdue" ? (
        <div><CompleteTraining id={id} title={course.title} requiresSignoff={course.requiresSignoff} /></div>
      ) : null}
    </PortalFrame>
  );
}
