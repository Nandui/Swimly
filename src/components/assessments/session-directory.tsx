import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AssessmentNav } from "./assessment-nav";
import { SESSION_STATUS_META, isPast, sessionDay, sessionSpan } from "@/lib/assessments/constants";
import type { SessionRow } from "@/lib/assessments/data/assessments";

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
  return <div className="min-w-0 space-y-6">
    <PageHeader title={setup ? "Assessment setup" : view === "past" ? "Past assessments" : "Upcoming assessments"}
      description={setup ? "Create sessions and manage their dates, places, assessors and parent booking settings." : "See what is running at this site, open the swimmer list and record assessment outcomes."}
      actions={createAction} />
    <AssessmentNav active={setup ? "setup" : "upcoming"} manage={manage} />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Session dates" className="flex flex-wrap gap-1">
        {(["upcoming", "past", ...(setup ? ["cancelled"] : [])] as SessionView[]).map(item => <Button asChild key={item}
          variant={view === item ? "secondary" : "ghost"} className="min-h-11">
          <Link href={item === "upcoming" ? base : `${base}?view=${item}`} aria-current={view === item ? "page" : undefined}>
            {item === "upcoming" ? "Today & upcoming" : item === "past" ? "Past sessions" : "Cancelled"}
          </Link>
        </Button>)}
      </nav>
      <p className="text-sm text-ui-muted-foreground" role="status">{matches.length} {matches.length === 1 ? "session" : "sessions"} · {booked} booked places</p>
    </div>
    {matches.length ? <Table className="table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader><TableRow>
        <TableHead scope="col">Session</TableHead>
        <TableHead scope="col" className="hidden w-1/5 lg:table-cell">Assessor</TableHead>
        <TableHead scope="col" className="hidden w-32 md:table-cell">Swimmers booked</TableHead>
        <TableHead scope="col" className="w-28 sm:w-44"><span className="sr-only">Open session</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{matches.map(s => {
        const full = s.capacity !== null && s._count.bookings >= s.capacity;
        const meta = s.cancelledAt ? SESSION_STATUS_META.cancelled : full ? SESSION_STATUS_META.full : null;
        return <TableRow key={s.id}>
          <TableCell className="py-4">
            <p className="font-semibold">{sessionDay(s)}</p>
            <p className="tabular-nums">{sessionSpan(s)}{s.location ? ` · ${s.location}` : ""}</p>
            <p className="text-sm text-ui-muted-foreground">{s.programme.name} · {s.type?.name ?? "Kind not set"}</p>
            <p className="text-sm text-ui-muted-foreground lg:hidden">Assessor: {s.instructor?.name ?? "Not assigned"}</p>
            <p className="mt-1 text-sm md:hidden">{s._count.bookings}{s.capacity !== null ? ` of ${s.capacity}` : ""} booked</p>
            {meta ? <Tag color={meta.color} className="mt-1">{meta.label}</Tag> : null}
          </TableCell>
          <TableCell className="hidden lg:table-cell">{s.instructor?.name ?? "Not assigned"}</TableCell>
          <TableCell className="hidden tabular-nums md:table-cell"><strong className="font-semibold">{s._count.bookings}</strong>{s.capacity !== null ? ` / ${s.capacity}` : " booked"}</TableCell>
          <TableCell className="text-right"><Button asChild variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal px-3 py-2">
            <Link href={`/assessments/${s.id}${setup ? "/setup" : ""}`} aria-label={`${setup ? "Set up session" : "View swimmers"}, ${sessionDay(s)}, ${sessionSpan(s)}`}>
              {setup ? "Set up" : "View swimmers"}<ArrowRight aria-hidden="true" className="hidden sm:block" />
            </Link>
          </Button></TableCell>
        </TableRow>;
      })}</TableBody>
    </Table> : <EmptyState icon="clipboardCheck"
      title={view === "upcoming" ? "No upcoming assessments" : view === "past" ? "No past assessments" : "No cancelled assessments"}
      hint={view === "upcoming" ? setup ? "Add a session to set its date, programme and places." : manage ? "Create a session in Assessment setup. It will appear here with its booked swimmers." : "Sessions scheduled for today and later will appear here." : "Sessions will appear here when they move into this list."}
      action={setup && view === "upcoming" ? createAction : manage && view === "upcoming" ? <Button asChild variant="outline" className="min-h-11"><Link href="/assessments/setup">Assessment setup</Link></Button> : undefined} />}
  </div>;
}
