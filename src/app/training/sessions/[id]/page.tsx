import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFact, RecordFacts, RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { hoursInWords } from "@/modules/training/features/hours";
import {
  AddToSession, CancelSession, CloseRegister, MarkEveryoneAttended, PLACE_STATUS_META, RegisterToggle, RemoveFromSession, SESSION_STATUS_META, SessionDialog, sessionDetail,
} from "@/modules/training/features/sessions";

export const metadata: Metadata = { title: "Session" };

/** One session: what it is, who is booked and, once it starts, the register.
 *  Who is listed follows the viewer's Training records reach. */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await sessionDetail((await params).id);
  if (!data) notFound();
  const { who, session: s, places, hidden, booked, attended, absent, assignable, canClose, closeBlock, courses, sites, types } = data;
  const state = s.cancelled ? "cancelled" : s.closedAt ? "closed" : s.registerOpen ? "register" : "upcoming";
  const left = s.capacity ? Math.max(0, s.capacity - booked) : null;
  const facts = [
    ["When", s.when],
    ["Where", [s.siteName, s.location].filter(Boolean).join(", ") || "Not set"],
    ["Trainer", s.trainerName || "Not set"],
    ["Places", s.capacity ? `${booked} of ${s.capacity} booked` : `${booked} booked, no limit`],
    ["Completes", s.course ?? "No course"],
    ["Hours", `${hoursInWords(s.minutes)} towards ${s.typeName ?? "general training hours"}`],
  ];
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/training/sessions", label: "Sessions" }} title={s.title}
        description={s.note || undefined}
        status={<Tag meta={SESSION_STATUS_META[state]} />}
        actions={s.open ? (
          <>
            {who.assign ? <SessionDialog courses={courses} sites={sites} types={types} session={{ id: s.id, title: s.title, courseId: s.courseId, siteId: s.siteId, location: s.location, date: s.date, start: s.start, minutes: s.minutes, capacity: s.capacity, trainerName: s.trainerName, hoursTypeId: s.hoursTypeId, note: s.note }} /> : null}
            {who.assign ? <CancelSession id={s.id} title={s.title} /> : null}
            {who.assign ? <AddToSession id={s.id} title={s.title} people={assignable} left={left} /> : null}
          </>
        ) : null} />}>
      <RecordSection id="facts-heading" title="Details">
        <div className="rec-card">
          <RecordFacts>
            {facts.map(([term, value]) => (
              <RecordFact key={term} label={term}>{term === "Completes" && s.courseId ? <Link href={`/training/courses/${s.courseId}`} className="text-ui-primary underline-offset-4 hover:underline">{value}</Link> : value}</RecordFact>
            ))}
          </RecordFacts>
        </div>
      </RecordSection>
      {s.closedAt ? <Notice tone="success" title="Register closed">{s.closedByName ?? "Someone"} closed it on {formatDate(s.closedAt)}: {attended} attended, {absent} absent.</Notice> : null}
      {s.cancelled ? <Notice tone="info" title="Cancelled">Nobody got hours or the course for this session.</Notice> : null}
      {places.length === 0 ? (
        <EmptyState as="h2" icon="calendarDays" title={hidden ? "Nobody you cover is booked" : "Nobody booked yet"} hint={who.assign && s.open ? "Book people on it. They see it in Turnfin Me." : undefined} />
      ) : (
        <RecordSection id="people-heading" title={s.registerOpen ? "Register" : "Booked"} aside={<p>{booked}</p>}
          note={[`${booked} booked`, attended ? `${attended} attended` : null, absent ? `${absent} absent` : null, hidden ? `${hidden} you don't cover` : null].filter(Boolean).join(" · ")}>
          {s.registerOpen ? (
            <div className="mb-(--space-3) flex flex-wrap items-center gap-3">
              <MarkEveryoneAttended placeIds={places.filter((p) => p.canMark && p.status === "BOOKED").map((p) => p.id)} />
              {canClose ? (closeBlock ? <p className="text-sm text-ui-muted-foreground">{closeBlock}</p> : <CloseRegister id={s.id} title={s.title} attended={attended} absent={absent} course={s.course} />) : null}
            </div>
          ) : null}
          <ul className="pc-list">
            {places.map((p) => (
              <li key={p.id} className="pc-row flex-wrap">
                <div className="pc-row-body">
                  <Link href={`/training/people/${p.userId}`} className="pc-row-title -my-3 inline-flex min-h-11 items-center self-start underline-offset-4 hover:underline">{p.name}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</Link>
                  <p className="pc-row-hint">Booked by {p.addedByName}</p>
                </div>
                <div className="pc-row-trail">
                  {p.canMark ? <RegisterToggle placeId={p.id} name={p.name} status={p.status} /> : <Tag meta={PLACE_STATUS_META[p.status]} />}
                  {p.canRemove && !s.registerOpen ? <RemoveFromSession placeId={p.id} name={p.name} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </RecordSection>
      )}
    </PageShell>
  );
}
