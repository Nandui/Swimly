import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnForPractice, SignOff, signoffQueue } from "@/modules/training/features/sign-off";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatDate, formatDateTime, nameInitials } from "@/lib/format";

export const metadata: Metadata = { title: "Sign-off" };

/** Practical training waiting for a trainer, for the people this trainer
 *  covers. Their own never appears: someone else signs that off. */
export default async function TrainingSignoffPage() {
  const { who, rows } = await signoffQueue();
  if (!who.signoff) notFound();
  return (
    <>
      <PageHeader title="Sign-off" description="People who say they are ready. Watch them do it, then sign it off or send it back with what to practise." />
      {rows.length === 0 ? (
        <EmptyState as="h2" icon="clipboardCheck" title="Nobody is waiting" hint="Practical training appears here when someone you cover asks for sign-off." />
      ) : (
        <section className="pc-panel" aria-label="Waiting for sign-off">
          <ul className="pc-rows">
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
                  <ReturnForPractice id={row.id} name={row.user.name} title={row.course.title} />
                  <SignOff id={row.id} name={row.user.name} title={row.course.title} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
