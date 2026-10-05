import Link from "next/link";
import { ChevronRight, ClipboardCheck, Settings2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { plural } from "@/lib/format";
import { SESSION_STATUS_META, isPast, sessionDay, sessionSpan } from "@/modules/activities/lib/assessments/constants";
import type { SessionRow } from "@/modules/activities/lib/assessments/data/assessments";
import { COURSE_STATUS_META } from "@/modules/activities/lib/courses/constants";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

export type SessionView = "upcoming" | "past" | "cancelled";
export function sessionView(value: unknown, setup = false): SessionView {
  return value === "past" ? "past" : value === "cancelled" && setup ? "cancelled" : "upcoming";
}

export function SessionDirectory({ sessions, today, setup = false, manage, view, createAction }: {
  sessions: SessionRow[]; today: string; setup?: boolean; manage: boolean; view: SessionView; createAction?: React.ReactNode;
}) {
  const base = setup ? "/assessments/setup" : "/assessments";
  const matches = sessions.filter(s => view === "cancelled" ? !!s.cancelledAt : !s.cancelledAt && (view === "past" ? isPast(s, today) : !isPast(s, today)));
  if (view !== "upcoming") matches.reverse();
  const booked = matches.reduce((sum, s) => sum + s._count.bookings, 0);
  // One bar only: the date lenses inside the list panel. Setup is a header action for managers,
  // and the setup page returns through its back link (V2Assessments).
  return <div className="min-w-0 flex flex-col gap-6">
    <PageHeader back={setup ? { href: "/assessments", label: "Assessments" } : undefined}
      title={setup ? "Assessment setup" : view === "past" ? "Past assessments" : "Upcoming assessments"}
      description={setup ? "Create sessions and manage their dates, places, assessors and parent booking settings" : view === "past" ? "Look back at earlier sessions, their swimmers and outcomes" : "See what is running at this site, open the swimmer list and record assessment outcomes"}
      actions={setup ? createAction : manage ? <Button asChild variant="outline"><Link href="/assessments/setup"><Settings2 aria-hidden="true" />Assessment setup</Link></Button> : undefined} />
    <section className="pc-panel" aria-label="Assessment sessions">
      <div className="min-w-0 flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks label="Session dates" items={(["upcoming", "past", ...(setup ? ["cancelled"] : [])] as SessionView[]).map(item => ({
          href: item === "upcoming" ? base : `${base}?view=${item}`, label: item === "upcoming" ? "Today and upcoming" : item === "past" ? "Past sessions" : "Cancelled", current: view === item }))} />
        <p className="text-xs text-ui-muted-foreground tabular-nums" role="status">{plural(matches.length, "session")} · {plural(booked, "booked place")}</p>
      </div>
      {matches.length ? <Table className="[&_td]:whitespace-normal [&_th]:whitespace-normal">
        <TableHeader><TableRow>
          <TableHead scope="col">Session</TableHead>
          <TableHead scope="col" className="hidden lg:table-cell">Assessor</TableHead>
          <TableHead scope="col" className="hidden md:table-cell">Swimmers booked</TableHead>
          <TableHead scope="col"><span className="sr-only">Open session</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>{matches.map(s => {
          const full = s.capacity !== null && s._count.bookings >= s.capacity;
          const meta = s.cancelledAt ? SESSION_STATUS_META.cancelled : full ? SESSION_STATUS_META.full : null;
          return <TableRow key={s.id}>
            <TableCell>
              <div className="min-w-0 flex gap-3 items-center">
                <span className="pc-tile-icon" aria-hidden="true"><ClipboardCheck /></span>
                <div className="min-w-0 flex flex-col items-start">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{sessionDay(s)}</span>{meta ? <Tag meta={meta} /> : null}</span>
                  <span className="pc-row-hint tabular-nums">{sessionSpan(s)}{s.location ? ` · ${s.location}` : ""}</span>
                  <span className="pc-row-hint">{s.programme.name} · {s.type?.name ?? "Kind not set"}</span>
                  <span className="pc-row-hint lg:hidden">Assessor: {s.instructor?.name ?? "Not assigned"}</span>
                  <span className="pc-row-hint tabular-nums md:hidden">{s._count.bookings}{s.capacity !== null ? ` of ${s.capacity}` : ""} booked</span>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden lg:table-cell">{s.instructor?.name ?? <Tag meta={COURSE_STATUS_META.unassigned} />}</TableCell>
            <TableCell className="hidden tabular-nums md:table-cell"><strong className="font-semibold">{s._count.bookings}</strong>{s.capacity !== null ? ` of ${s.capacity}` : " booked"}</TableCell>
            {/* Phones: a 44px icon button (words in .pc-only-wide, named by aria-label), so the
                session cell keeps the width. */}
            <TableCell className="w-px text-right"><Button asChild variant="outline">
              <Link href={`/assessments/${s.id}${setup ? "/setup" : ""}`} aria-label={`${setup ? "Set up session" : "View swimmers"}, ${sessionDay(s)}, ${sessionSpan(s)}`}>
                <span className="pc-only-wide">{setup ? "Set up" : "View swimmers"}</span><ChevronRight aria-hidden="true" />
              </Link>
            </Button></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table> : <EmptyState icon="clipboardCheck"
        title={view === "upcoming" ? "No upcoming assessments" : view === "past" ? "No past assessments" : "No cancelled assessments"}
        hint={view === "upcoming" ? setup ? "Choose Add a session to set its date, programme and places." : manage ? "Create a session in Assessment setup. It will appear here with its booked swimmers." : "Sessions scheduled for today and later will appear here." : "Sessions will appear here when they move into this list."} />}
    </section>
  </div>;
}
