import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ReturnForPractice, SignOff, signoffQueue } from "@/modules/training/features/sign-off";
import { HandInQueue, handInQueue } from "@/modules/training/features/hand-ins";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { formatDate, formatDateTime, nameInitials } from "@/lib/format";

export const metadata: Metadata = { title: "Sign-off" };

/** Practical training waiting for a trainer, for the people this trainer
 *  covers. Their own never appears: someone else signs that off. */
export default async function TrainingSignoffPage() {
  const [{ who, rows }, handIns] = await Promise.all([signoffQueue(), handInQueue()]);
  if (!who.signoff) notFound();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Sign-off" description="People who say they are ready, and work handed in to check. Watch them do it, then sign it off or send it back with what to practise." />}>
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="clipboardCheck" title="Nobody is waiting" hint="Practical training appears here when someone you cover asks for sign-off." />
      ) : (
        <RecordSection id="signoff-heading" title="Waiting for sign-off" aside={<p>{rows.length}</p>}>
          <ul className="pc-list">
            {rows.map((row) => (
              <li key={row.id} className="pc-row">
                <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.user.name)}</AvatarFallback></Avatar>
                <div className="pc-row-body">
                  <Link href={`/training/people/${row.user.id}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{row.user.name}{row.user.jobTitle ? ` · ${row.user.jobTitle}` : ""}</Link>
                  <p className="pc-row-hint">{row.course.title}{row.course.grantsType ? ` · records ${row.course.grantsType.name}` : ""}</p>
                  <p className="pc-row-hint">Ready since {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}{row.dueOn ? ` · due ${formatDate(row.dueOn)}` : ""}</p>
                  {row.learnerNote ? <p className="pc-row-hint">Their note: {row.learnerNote}</p> : null}
                </div>
                <div className="pc-row-trail">
                  {row.steps ? (
                    <Button asChild className="min-h-11"><Link href={`/training/sign-off/${row.id}`}><ClipboardCheck aria-hidden="true" />Observe ({row.steps} steps)</Link></Button>
                  ) : (
                    <>
                      <ReturnForPractice id={row.id} name={row.user.name} title={row.course.title} />
                      <SignOff id={row.id} name={row.user.name} title={row.course.title} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </RecordSection>
      )}
      <HandInQueue rows={handIns} />
    </PageShell>
  );
}
