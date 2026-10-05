import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Download, FileText, UserX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { AddNote, StartReview, WithdrawNote } from "@/components/hr/actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { NOTE_VISIBILITY_META, REVIEW_STATUS_META } from "@/lib/hr/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { hrPerson } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";
import { AuthorizationError } from "@/lib/authz";
import { hrConfigured } from "@/lib/hr/database";

/** The tile icon for each module's section of the person's file, by its stable key. */
const FILE_ICONS: Record<string, LucideIcon> = { "rota.absences": UserX, "rota.changes": CalendarClock };

/** One read (and one access log row) per request, shared by the page and its tab title. */
const load = cache(hrPerson);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  // Switched off: the layout shows a notice in place of the page.
  if (!hrConfigured()) return { title: "HR" };
  try {
    await requireFreshSession("hr.records.read", `/hr/people/${id}`);
    return { title: (await load(id)).person.name };
  } catch (error) {
    // No HR access: the layout turns the page into a 404, so the title is the 404 page's.
    if (error instanceof AuthorizationError) return { title: "Page not found" };
    throw error;
  }
}

export default async function HrPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireFreshSession("hr.records.read", `/hr/people/${id}`);
  const data = await load(id);
  const { person, notes, reviews, who } = data;
  return (
    <>
      <PageHeader
        back={{ href: "/hr", label: "People" }}
        title={person.name}
        description={person.jobTitle || "HR record"}
        actions={
          <>
            {who.superadmin ? <Button asChild variant="ghost" className="min-h-11"><a href={`/hr/people/${person.id}/export`}><Download aria-hidden="true" />Export everything</a></Button> : null}
            {data.canWriteReviews ? <StartReview subjectUserId={person.id} name={person.name} /> : null}
            {data.canWriteNotes ? <AddNote subjectUserId={person.id} name={person.name} /> : null}
          </>
        }
      />
      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="hr-notes">
          <div className="pc-panel-head"><h2 id="hr-notes">Notes</h2></div>
          {notes.length === 0 ? <EmptyState compact icon="scrollText" title="No notes you can read" /> : (
            <ul className="pc-rows">
              {notes.map((n) => (
                <li key={n.id} className="pc-row">
                  {/* A note is prose: it keeps a readable width, and the tag and Withdraw wrap under it. */}
                  <div className="pc-row-body min-w-[min(100%,18rem)]!">
                    <span className="pc-row-title">{n.authorName} · {formatDateTime(new Date(n.createdAt))}</span>
                    <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                  </div>
                  <div className="pc-row-trail">
                    <Tag meta={NOTE_VISIBILITY_META[n.visibility]} />
                    {data.canWriteNotes && (n.authorId === who.id || who.superadmin) ? <WithdrawNote id={n.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="hr-reviews">
          <div className="pc-panel-head"><h2 id="hr-reviews">Performance reviews</h2></div>
          {reviews.length === 0 ? <EmptyState compact icon="clipboardList" title="No reviews yet" /> : (
            <ul className="pc-rows">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link href={`/hr/reviews/${r.id}`} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{r.period}</span>
                      <span className="pc-row-hint">{r.reviewerName} · {r.sharedAt ? `shared ${formatDate(new Date(r.sharedAt))}` : `started ${formatDate(new Date(r.createdAt))}`}</span>
                    </span>
                    <span className="pc-row-trail">
                      <Tag meta={REVIEW_STATUS_META[r.status]} />
                      <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {data.file.map((section) => {
        const Icon = FILE_ICONS[section.id] ?? FileText;
        return (
        <section key={section.id} className="pc-panel" aria-labelledby={`file-${section.id}`}>
          <div className="pc-panel-head"><h2 id={`file-${section.id}`}>{section.heading}</h2></div>
          <p className="text-sm text-ui-muted-foreground">{section.summary}</p>
          {section.entries.length ? (
            <ul className="pc-rows">
              {section.entries.map((e) => (
                <li key={e.id} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <div className="pc-row-body">
                    <span className="pc-row-title">{e.title}</span>
                    <span className="pc-row-hint">{e.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        );
      })}
    </>
  );
}
