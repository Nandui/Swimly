import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { AddNote, StartReview, WithdrawNote } from "@/components/hr/actions";
import { NoteVisibilityTag, ReviewStatusTag } from "@/components/hr/status";
import { formatDate, formatDateTime } from "@/lib/format";
import { hrPerson } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "HR record" };

export default async function HrPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireFreshSession("hr.records.read", `/hr/people/${id}`);
  const data = await hrPerson(id);
  const { person, notes, reviews, who } = data;
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>{person.name}</h1>
          <p className="text-sm">{person.jobTitle || "HR record"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.canWriteNotes ? <AddNote subjectUserId={person.id} name={person.name} /> : null}
          {data.canWriteReviews ? <StartReview subjectUserId={person.id} name={person.name} /> : null}
          {who.superadmin ? <Button asChild variant="ghost" className="min-h-11"><a href={`/hr/people/${person.id}/export`}><Download aria-hidden="true" />Export everything</a></Button> : null}
        </div>
      </div>
      <div className="module-columns">
        <section className="module-panel" aria-labelledby="hr-notes">
          <h2 id="hr-notes">Notes</h2>
          {notes.length === 0 ? <p className="text-sm text-ui-muted-foreground">No notes you can read.</p> : (
            <ul>
              {notes.map((n) => (
                <li key={n.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-ui-muted-foreground">{n.authorName} · {formatDateTime(new Date(n.createdAt))}</p>
                    <NoteVisibilityTag visibility={n.visibility} />
                  </div>
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  {data.canWriteNotes && (n.authorId === who.id || who.superadmin) ? <WithdrawNote id={n.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="module-panel" aria-labelledby="hr-reviews">
          <h2 id="hr-reviews">Performance reviews</h2>
          {reviews.length === 0 ? <p className="text-sm text-ui-muted-foreground">No reviews yet.</p> : (
            <ul>
              {reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <Link href={`/hr/reviews/${r.id}`} className="-mx-2 block space-y-1 rounded-[var(--pc-radius-control)] px-2 py-1 hover:bg-[var(--pc-surface-sunken)]">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.period}</span><ReviewStatusTag status={r.status} /></span>
                    <span className="block text-xs text-ui-muted-foreground">{r.reviewerName} · {r.sharedAt ? `shared ${formatDate(new Date(r.sharedAt))}` : `started ${formatDate(new Date(r.createdAt))}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {data.file.map((section) => (
        <section key={section.id} className="module-panel" aria-labelledby={`file-${section.id}`}>
          <h2 id={`file-${section.id}`}>{section.heading}</h2>
          <p className="text-sm text-ui-muted-foreground">{section.summary}</p>
          {section.entries.length ? (
            <ul className="mt-2 divide-y divide-ui-border">
              {section.entries.map((e) => (
                <li key={e.id} className="space-y-1 py-3">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-ui-muted-foreground">{e.detail}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
