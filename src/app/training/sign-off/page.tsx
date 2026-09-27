import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { ReturnForPractice, SignOff } from "@/components/training/manage-actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { signoffQueue } from "@/lib/training/data";

export const metadata: Metadata = { title: "Sign-off" };

/** Practical training waiting for a trainer, for the people this trainer
 *  covers. Their own never appears: someone else signs that off. */
export default async function TrainingSignoffPage() {
  const { who, rows } = await signoffQueue();
  if (!who.signoff) notFound();
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Sign-off</h1>
          <p className="text-sm">People who say they are ready. Watch them do it, then sign it off or send it back with what to practise.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="module-empty"><ClipboardCheck aria-hidden="true" /><h2 className="font-semibold">Nobody is waiting</h2><p className="mt-2 text-sm text-ui-muted-foreground">Practical training appears here when someone you cover asks for sign-off.</p></div>
      ) : (
        <ul className="module-list">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="module-row-title"><Link href={`/training/people/${row.user.id}`} className="underline-offset-4 hover:underline">{row.user.name}</Link>{row.user.jobTitle ? <span className="text-sm font-normal text-ui-muted-foreground"> · {row.user.jobTitle}</span> : null}</p>
                <p className="text-sm">{row.course.title}{row.course.grantsType ? ` · records ${row.course.grantsType.name}` : ""}</p>
                <p className="text-xs text-ui-muted-foreground">Ready since {row.submittedAt ? formatDateTime(row.submittedAt) : "—"}{row.dueOn ? ` · due ${formatDate(row.dueOn)}` : ""}</p>
                {row.learnerNote ? <p className="text-sm"><span className="font-semibold">Their note: </span>{row.learnerNote}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <SignOff id={row.id} name={row.user.name} title={row.course.title} />
                <ReturnForPractice id={row.id} name={row.user.name} title={row.course.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
