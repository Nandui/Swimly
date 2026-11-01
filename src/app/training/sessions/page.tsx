import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { listSessions, SESSION_STATUS_META, SessionDialog, type SessionRow } from "@/modules/training/features/sessions";

export const metadata: Metadata = { title: "Sessions" };

function Rows({ rows, label }: { rows: SessionRow[]; label: string }) {
  return (
    <ul className="pc-list" aria-label={label}>
      {rows.map((s) => (
        <li key={s.id}>
          <Link href={`/training/sessions/${s.id}`} className="pc-row">
            <span className="pc-tile-icon" data-tone={s.state === "register" ? "orange" : undefined} aria-hidden="true"><CalendarDays /></span>
            <span className="pc-row-body">
              <span className="pc-row-title">{s.title}</span>
              <span className="pc-row-hint tabular-nums">{s.when}{s.where ? ` · ${s.where}` : ""}{s.trainerName ? ` · with ${s.trainerName}` : ""}</span>
              {s.course ? <span className="pc-row-hint">Completes {s.course}</span> : null}
            </span>
            <span className="pc-row-trail">
              <span className="pc-row-value">{s.booked}{s.capacity ? ` of ${s.capacity}` : ""} booked</span>
              <Tag meta={SESSION_STATUS_META[s.state]} />
              <ChevronRight aria-hidden="true" className="pc-row-chevron" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Classroom and poolside sessions (e-learning phase 5): in-service training,
 *  practical courses and refreshers people are booked on, with a register. */
export default async function SessionsPage() {
  const { who, upcoming, register, past, courses, sites, types } = await listSessions();
  const none = !upcoming.length && !register.length && !past.length;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Sessions" description="Classroom and poolside training with places and a register. Closing the register counts everyone's hours and completes the course it teaches."
        actions={who.assign ? <SessionDialog courses={courses} sites={sites} types={types} /> : null} />}>
      {none ? (
        <EmptyState as="h2" icon="calendarDays" title="No sessions yet" hint={who.assign ? "Plan your next in-service, for example a monthly lifeguard training hour." : "Someone who assigns training can plan them."} />
      ) : null}
      {register.length ? (
        <RecordSection id="register-heading" title="Registers to close" aside={<p>{register.length}</p>}>
          <Rows rows={register} label="Registers to close" />
        </RecordSection>
      ) : null}
      {upcoming.length ? (
        <RecordSection id="upcoming-heading" title="Coming up" aside={<p>{upcoming.length}</p>}>
          <Rows rows={upcoming} label="Coming up" />
        </RecordSection>
      ) : null}
      {past.length ? (
        <RecordSection id="past-heading" title="Past" aside={<p>{past.length}</p>}>
          <Rows rows={past} label="Past sessions" />
        </RecordSection>
      ) : null}
    </PageShell>
  );
}
