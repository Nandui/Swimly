import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { listSessions, SESSION_STATUS_META, SessionDialog, type SessionRow } from "@/modules/training/features/sessions";

export const metadata: Metadata = { title: "Sessions" };

function Rows({ rows, label }: { rows: SessionRow[]; label: string }) {
  return (
    <ul className="pc-rows" aria-label={label}>
      {rows.map((s) => (
        <li key={s.id}>
          <Link href={`/training/sessions/${s.id}`} className="pc-row">
            <span className="pc-row-body">
              <span className="pc-row-title">{s.title}</span>
              <span className="pc-row-hint tabular-nums">{s.when}{s.where ? ` · ${s.where}` : ""}{s.trainerName ? ` · with ${s.trainerName}` : ""}</span>
              {s.course ? <span className="pc-row-hint">Completes {s.course}</span> : null}
            </span>
            <span className="pc-row-trail">
              <span className="text-sm text-ui-muted-foreground tabular-nums">{s.booked}{s.capacity ? ` of ${s.capacity}` : ""} booked</span>
              <Tag meta={SESSION_STATUS_META[s.state]} />
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
    <PageShell header={<PageHeader title="Sessions" description="Classroom and poolside training with places and a register. Closing the register counts everyone's hours and completes the course it teaches."
        actions={who.assign ? <SessionDialog courses={courses} sites={sites} types={types} /> : null} />}>
      {none ? (
        <EmptyState as="h2" icon="calendarDays" title="No sessions yet" hint={who.assign ? "Plan your next in-service, for example a monthly lifeguard training hour." : "Someone who assigns training can plan them."} />
      ) : null}
      {register.length ? (
        <section className="pc-panel" aria-labelledby="register-heading">
          <div className="pc-panel-head"><h2 id="register-heading">Registers to close</h2><span className="text-sm text-ui-muted-foreground tabular-nums">{register.length}</span></div>
          <Rows rows={register} label="Registers to close" />
        </section>
      ) : null}
      {upcoming.length ? (
        <section className="pc-panel" aria-labelledby="upcoming-heading">
          <div className="pc-panel-head"><h2 id="upcoming-heading">Coming up</h2><span className="text-sm text-ui-muted-foreground tabular-nums">{upcoming.length}</span></div>
          <Rows rows={upcoming} label="Coming up" />
        </section>
      ) : null}
      {past.length ? (
        <section className="pc-panel" aria-labelledby="past-heading">
          <h2 id="past-heading">Past</h2>
          <Rows rows={past} label="Past sessions" />
        </section>
      ) : null}
    </PageShell>
  );
}
