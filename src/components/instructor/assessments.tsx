import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { instructorAssessmentHref, type ClassQuery } from "@/lib/attendance/navigation";
import { formatTime } from "@/lib/courses/constants";
import type { CalendarAssessment } from "@/lib/today/calendar";

/** Dated assessments are site-wide, independently of the weekly My/All classes filter. */
export function InstructorAssessments({ sessions, canRun, params = {} }: {
  sessions: CalendarAssessment[];
  canRun: boolean;
  params?: ClassQuery;
}) {
  if (!sessions.length) return null;
  return (
    <section aria-labelledby="instructor-assessments" className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-3 border-b border-ui-border pb-3">
        <h2 id="instructor-assessments" className="text-lg font-semibold">Assessments today</h2>
        <p className="text-sm text-ui-muted-foreground">{sessions.length} {sessions.length === 1 ? "session" : "sessions"} at this site</p>
      </div>
      <ItemGroup className="divide-y divide-ui-border">
        {sessions.map(session => (
          <Item key={session.id} role="listitem" className="items-center rounded-none px-0 py-5">
            <div className="min-w-0 basis-20 shrink-0">
              <p className="text-base font-semibold tabular-nums">{formatTime(session.startMinutes)}</p>
              <p className="text-xs text-ui-muted-foreground">{formatTime(session.startMinutes + session.durationMinutes)}</p>
            </div>
            <ItemContent className="min-w-0 basis-44">
              <h3 className="text-base font-semibold break-words">{session.typeName ?? "Swim School Assessment"}</h3>
              <p className="text-sm text-ui-muted-foreground break-words">{session.programmeName} · {session.location || "Pool"}</p>
              <p className="text-sm text-ui-muted-foreground">{session.instructor?.name ?? "Assessor not assigned"} · {session.booked} booked{session.capacity === null ? "" : ` / ${session.capacity} places`}</p>
            </ItemContent>
            {canRun ? (
              <Button asChild variant="outline">
                <Link href={instructorAssessmentHref(session.id, params)} aria-label={`Open assessment: ${session.typeName ?? session.programmeName}, ${formatTime(session.startMinutes)}`}>
                  Open assessment<ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : <p className="text-sm text-ui-muted-foreground">Ask a manager for access to run assessments.</p>}
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
