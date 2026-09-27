import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
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
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href="/hr" current={person.name}>HR</BackLink>
      <PageHeader
        title={person.name}
        description={person.jobTitle || "HR record"}
        actions={<>
          {data.canWriteNotes ? <AddNote subjectUserId={person.id} name={person.name} /> : null}
          {data.canWriteReviews ? <StartReview subjectUserId={person.id} name={person.name} /> : null}
          {who.superadmin ? <Button asChild variant="ghost" className="min-h-11"><a href={`/hr/people/${person.id}/export`}><Download aria-hidden="true" />Export everything</a></Button> : null}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <Card className="gap-3 p-5 shadow-none" aria-labelledby="hr-notes">
          <h2 id="hr-notes" className="text-lg font-semibold">Notes</h2>
          {notes.length === 0 ? <p className="text-sm text-ui-muted-foreground">No notes you can read.</p> : (
            <ul className="divide-y divide-ui-border">
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
        </Card>
        <Card className="gap-3 p-5 shadow-none" aria-labelledby="hr-reviews">
          <h2 id="hr-reviews" className="text-lg font-semibold">Performance reviews</h2>
          {reviews.length === 0 ? <p className="text-sm text-ui-muted-foreground">No reviews yet.</p> : (
            <ul className="divide-y divide-ui-border">
              {reviews.map((r) => (
                <li key={r.id} className="py-2">
                  <Link href={`/hr/reviews/${r.id}`} className="-mx-2 block space-y-1 rounded-ui-md px-2 py-2 hover:bg-ui-muted/50">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{r.period}</span><ReviewStatusTag status={r.status} /></span>
                    <span className="block text-xs text-ui-muted-foreground">{r.reviewerName} · {r.sharedAt ? `shared ${formatDate(new Date(r.sharedAt))}` : `started ${formatDate(new Date(r.createdAt))}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
