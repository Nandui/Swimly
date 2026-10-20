import Link from "next/link";
import { FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { formatDate, formatDateTime, nameInitials } from "@/lib/format";
import type { HandInRow } from "@/modules/training/features/hand-ins/server/data";
import { AcceptHandIn, ReturnHandIn } from "@/modules/training/features/hand-ins/components/hand-in-actions";

/** Work handed in that waits for a trainer, on the Sign-off page (phase 8). */
export function HandInQueue({ rows }: { rows: HandInRow[] }) {
  return (
    <section className="pc-panel flex flex-col gap-3" aria-labelledby="hand-ins-heading">
      <div className="space-y-1">
        <h2 id="hand-ins-heading">Work handed in · {rows.length}</h2>
        <p className="text-sm text-ui-muted-foreground">Answers and photos from Hand in work lessons. Accepting one finishes that lesson; sending it back asks them to change it.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState compact icon="clipboardCheck" title="Nothing to check" hint="Work appears here when someone you cover hands it in on a lesson that asks for a trainer." />
      ) : (
        <ul className="pc-rows">
          {rows.map((row) => (
            <li key={row.id} className="pc-row items-start">
              <Avatar size="lg" aria-hidden="true"><AvatarFallback>{nameInitials(row.user.name)}</AvatarFallback></Avatar>
              <div className="pc-row-body gap-2">
                <Link href={`/training/people/${row.user.id}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{row.user.name}{row.user.jobTitle ? ` · ${row.user.jobTitle}` : ""}</Link>
                <p className="pc-row-hint">{row.course} · {row.lesson}</p>
                <p className="pc-row-hint">Handed in {formatDateTime(row.submittedAt)}{row.dueOn ? ` · due ${formatDate(row.dueOn)}` : ""}</p>
                {row.text ? <blockquote className="rounded-card bg-ui-muted p-3 text-sm whitespace-pre-line">{row.text}</blockquote> : null}
                {row.fileName ? (
                  row.isImage ? (
                    <a href={`/training/hand-ins/${row.id}/file`} target="_blank" rel="noopener noreferrer" className="self-start">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
                      <img src={`/training/hand-ins/${row.id}/file`} alt={`Photo handed in by ${row.user.name}`} loading="lazy" className="max-h-56 w-fit rounded-card" />
                    </a>
                  ) : <Button asChild variant="outline" className="min-h-11 self-start"><a href={`/training/hand-ins/${row.id}/file`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Open {row.fileName}</a></Button>
                ) : null}
              </div>
              <div className="pc-row-trail">
                <ReturnHandIn id={row.id} name={row.user.name} lesson={row.lesson} />
                <AcceptHandIn id={row.id} name={row.user.name} lesson={row.lesson} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
