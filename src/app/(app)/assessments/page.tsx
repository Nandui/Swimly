import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/shadcn/table";
import { cn } from "@/lib/utils";

import UiLink from "next/link";

import type { Metadata } from "next";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import {
  AddSession,
  CancelSession,
  EditSession,
} from "@/components/assessments/session-actions";
import {
  SESSION_STATUS_META,
  isPast,
  sessionDay,
  sessionSpan,
} from "@/lib/assessments/constants";
import {
  getAssessmentProgrammeOptions,
  getAssessmentSessions,
  getAssessmentTypeOptions,
  type AssessmentTypeOption,
  type ProgrammeOption,
  type SessionRow,
} from "@/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import {
  getInstructorOptions,
  type InstructorOption,
} from "@/lib/courses/data/courses";
import { today } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const session = await screenPage("assessments");
  const manage = can(session, "courses.manage");
  const todayIso = today();

  const [sessions, programmes, types, instructors] = await Promise.all([
    getAssessmentSessions(),
    manage ? getAssessmentProgrammeOptions() : Promise.resolve([]),
    manage ? getAssessmentTypeOptions() : Promise.resolve([]),
    manage ? getInstructorOptions() : Promise.resolve([]),
  ]);

  const live = sessions.filter((s) => !s.cancelledAt);
  const upcoming = live.filter((s) => !isPast(s, todayIso));
  const past = live.filter((s) => isPast(s, todayIso)).reverse();
  const cancelled = sessions.filter((s) => s.cancelledAt).reverse();

  const placesLeft = upcoming.reduce(
    (n, s) =>
      n +
      (s.capacity === null ? 0 : Math.max(0, s.capacity - s._count.bookings)),
    0,
  );
  const uncapped = upcoming.some((s) => s.capacity === null);

  const add = manage ? (
    <AddSession
      programmes={programmes}
      types={types}
      instructors={instructors}
      today={todayIso}
    />
  ) : null;

  const tableProps = {
    manage,
    programmes,
    types,
    instructors,
    today: todayIso,
  };

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Assessments"
        description="Book a child onto a session; once they have been in the water, place them at the level they belong at."
        actions={add}
      />

      <Lead>
        {upcoming.length === 0 ? (
          "No sessions coming up."
        ) : (
          <>
            <Num>{upcoming.length}</Num>{" "}
            {upcoming.length === 1 ? "session" : "sessions"} coming up
            {uncapped ? (
              ", with no limit on places"
            ) : (
              <>
                , with <Num>{placesLeft}</Num>{" "}
                {placesLeft === 1 ? "place" : "places"} left between them
              </>
            )}
            .
          </>
        )}
      </Lead>

      {sessions.length === 0 ? (
        <EmptyState
          icon="clipboardCheck"
          title="No assessment sessions yet"
          hint="Add the first — a date, a time and how many children can be watched at once. The desk books children onto it from there."
          action={add}
        />
      ) : (
        <div className="min-w-0 flex flex-col gap-6">
          <section className="min-w-0 flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ui-muted-foreground block">
                Nothing scheduled.
              </p>
            ) : (
              <SessionTable sessions={upcoming} {...tableProps} />
            )}
          </section>

          {past.length > 0 ? (
            <section className="min-w-0 flex flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">
                Already run
              </h2>
              <SessionTable sessions={past} {...tableProps} />
            </section>
          ) : null}

          {cancelled.length > 0 ? (
            <section className="min-w-0 flex flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">
                Cancelled
              </h2>
              <SessionTable
                sessions={cancelled}
                {...tableProps}
                manage={false}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SessionTable({
  sessions,
  manage,
  programmes,
  types,
  instructors,
  today,
}: {
  sessions: SessionRow[];
  manage: boolean;
  programmes: ProgrammeOption[];
  types: AssessmentTypeOption[];
  instructors: InstructorOption[];
  today: string;
}) {
  return (
    <Table className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">When</TableHead>
          <TableHead scope="col" className={"max-md:hidden"}>
            Programme
          </TableHead>
          <TableHead scope="col" className={"max-lg:hidden"}>
            Assessor
          </TableHead>
          <TableHead scope="col" className={"max-md:hidden"}>
            Places
          </TableHead>
          {manage ? (
            <TableHead scope="col">
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => {
          const taken = s._count.bookings;
          const full = s.capacity !== null && taken >= s.capacity;
          return (
            <TableRow key={s.id}>
              <TableCell>
                <div className="min-w-0 flex gap-2 items-center flex-wrap">
                  <UiLink
                    href={`/assessments/${s.id}`}
                    className={
                      "text-ui-foreground underline-offset-4 hover:underline font-medium"
                    }
                  >
                    {sessionDay(s)}
                  </UiLink>
                  {s.cancelledAt ? (
                    <Tag color={SESSION_STATUS_META.cancelled.color}>
                      {SESSION_STATUS_META.cancelled.label}
                    </Tag>
                  ) : full ? (
                    <Tag color={SESSION_STATUS_META.full.color}>
                      {SESSION_STATUS_META.full.label}
                    </Tag>
                  ) : null}
                </div>
                <span
                  className={
                    "text-sm text-ui-muted-foreground block tabular-nums"
                  }
                >
                  {sessionSpan(s)}
                  {s.location ? ` · ${s.location}` : ""}
                </span>
                <span
                  className={cn(
                    "text-sm text-ui-muted-foreground block",
                    "md:hidden",
                  )}
                >
                  {s.programme.name} · {s.type?.name ?? "kind not set"}
                </span>
                <span
                  className={cn(
                    "text-sm text-ui-muted-foreground block",
                    "lg:hidden",
                  )}
                >
                  Assessor:{" "}
                  {s.instructor?.name ?? SESSION_STATUS_META.unassigned.label}
                </span>
                <span
                  className={cn(
                    "text-sm text-ui-muted-foreground block tabular-nums",
                    "md:hidden",
                  )}
                >
                  {s.capacity === null
                    ? `${taken} booked`
                    : `${taken} of ${s.capacity} places booked`}
                </span>
              </TableCell>
              <TableCell className={"max-md:hidden"}>
                <span className="text-sm text-ui-muted-foreground">
                  {s.programme.name}
                </span>
                {s.type ? (
                  <span className="text-sm text-ui-muted-foreground block">
                    {s.type.name}
                  </span>
                ) : (
                  <Tag color={SESSION_STATUS_META.missingKind.color}>
                    {SESSION_STATUS_META.missingKind.label}
                  </Tag>
                )}
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                {s.instructor ? (
                  <span className="text-sm text-ui-muted-foreground">
                    {s.instructor.name}
                  </span>
                ) : (
                  <Tag color={SESSION_STATUS_META.unassigned.color}>
                    {SESSION_STATUS_META.unassigned.label}
                  </Tag>
                )}
              </TableCell>
              <TableCell className={"max-md:hidden"}>
                <span
                  className={
                    "text-sm text-ui-muted-foreground whitespace-nowrap tabular-nums"
                  }
                >
                  {s.capacity === null
                    ? `${taken} booked`
                    : `${taken} of ${s.capacity}`}
                </span>
              </TableCell>
              {manage ? (
                <TableCell>
                  {s.cancelledAt ? null : (
                    <div
                      className={
                        "min-w-0 flex gap-1 items-center justify-end flex-wrap"
                      }
                    >
                      <EditSession
                        session={s}
                        programmes={programmes}
                        types={types}
                        instructors={instructors}
                        today={today}
                      />
                      <CancelSession session={s} />
                    </div>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
