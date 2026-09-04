import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddSession, CancelSession, EditSession } from "@/components/assessments/session-actions";
import { isPast, sessionDay, sessionSpan } from "@/lib/assessments/constants";
import {
  getAssessmentProgrammeOptions,
  getAssessmentSessions,
  getAssessmentTypeOptions,
  type AssessmentTypeOption,
  type ProgrammeOption,
  type SessionRow,
} from "@/lib/assessments/data/assessments";
import { can } from "@/lib/authz";
import { getInstructorOptions, type InstructorOption } from "@/lib/courses/data/courses";
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
    (n, s) => n + (s.capacity === null ? 0 : Math.max(0, s.capacity - s._count.bookings)),
    0
  );
  const uncapped = upcoming.some((s) => s.capacity === null);

  const add = manage ? (
    <AddSession programmes={programmes} types={types} instructors={instructors} today={todayIso} />
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Book a child onto a session; once they have been in the water, place them at the level they belong at."
        actions={add}
      />

      <p className="max-w-prose text-sm text-muted-foreground">
        {upcoming.length === 0 ? (
          "No sessions coming up."
        ) : (
          <>
            <span className="font-medium text-foreground tabular-nums">{upcoming.length}</span>{" "}
            {upcoming.length === 1 ? "session" : "sessions"} coming up
            {uncapped ? (
              ", with no limit on places"
            ) : (
              <>
                , with{" "}
                <span className="font-medium text-foreground tabular-nums">{placesLeft}</span>{" "}
                {placesLeft === 1 ? "place" : "places"} left between them
              </>
            )}
            .
          </>
        )}
      </p>

      {sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No assessment sessions yet"
          hint="Add the first — a date, a time and how many children can be watched at once. The desk books children onto it from there."
          action={add}
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <SessionTable
                sessions={upcoming}
                manage={manage}
                programmes={programmes}
                types={types}
                instructors={instructors}
                today={todayIso}
              />
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Already run</h2>
              <SessionTable
                sessions={past}
                manage={manage}
                programmes={programmes}
                types={types}
                instructors={instructors}
                today={todayIso}
              />
            </section>
          ) : null}

          {cancelled.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Cancelled</h2>
              <SessionTable
                sessions={cancelled}
                manage={false}
                programmes={programmes}
                types={types}
                instructors={instructors}
                today={todayIso}
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
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              When
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden">
              Programme
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-lg:hidden">
              Assessor
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Places
            </th>
            <th scope="col" className="w-20 px-3 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const taken = s._count.bookings;
            const full = s.capacity !== null && taken >= s.capacity;
            return (
              <tr key={s.id} className="group border-b transition-colors last:border-0 hover:bg-accent/40">
                <td className="px-3 py-2 font-medium text-foreground">
                  <Link href={`/assessments/${s.id}`} className="underline-offset-2 hover:underline">
                    {sessionDay(s)}
                  </Link>
                  {s.cancelledAt ? (
                    <Tag color="gray" className="ml-2">
                      Cancelled
                    </Tag>
                  ) : full ? (
                    <Tag color="yellow" className="ml-2">
                      Full
                    </Tag>
                  ) : null}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground tabular-nums">
                    {sessionSpan(s)}
                    {s.location ? ` · ${s.location}` : ""}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {s.programme.name} · {s.type?.name ?? "kind not set"}
                    {s.instructor ? ` · ${s.instructor.name}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground max-md:hidden">
                  {s.programme.name}
                  <span className={s.type ? "mt-0.5 block text-xs" : "mt-0.5 block text-xs text-(--tag-orange-fg)"}>
                    {s.type?.name ?? "Kind not set"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground max-lg:hidden">
                  {s.instructor?.name ?? <span className="text-(--tag-orange-fg)">Not decided</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                  {s.capacity === null ? `${taken} booked` : `${taken} of ${s.capacity}`}
                </td>
                <td className="px-3 py-2">
                  {manage && !s.cancelledAt ? (
                    <div className="flex items-center justify-end gap-0.5 max-md:gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                      <EditSession session={s} programmes={programmes} types={types} instructors={instructors} today={today} />
                      <CancelSession session={s} />
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
