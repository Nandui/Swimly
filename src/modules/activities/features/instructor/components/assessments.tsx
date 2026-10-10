import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { formatTimeRange, plural } from "@/lib/format";
import { instructorAssessmentHref, type ClassQuery } from "@/modules/activities/shared/attendance/navigation";
import { formatTime } from "@/modules/activities/shared/courses/constants";
import type { CalendarAssessment } from "@/modules/activities/shared/today/calendar";

/** Dated assessments are site-wide, independently of the weekly My/All classes filter. */
export function InstructorAssessments({ sessions, canRun, params = {} }: {
  sessions: CalendarAssessment[];
  canRun: boolean;
  params?: ClassQuery;
}) {
  if (!sessions.length) return null;
  return (
    <section aria-labelledby="instructor-assessments" className="pc-panel">
      <div className="pc-panel-head">
        <h2 id="instructor-assessments">Assessments today</h2>
        <p className="pc-row-hint">{plural(sessions.length, "session")} at this site</p>
      </div>
      <ul className="pc-rows">
        {sessions.map(session => (
          <li key={session.id} className="pc-row">
            <span className="pc-tile-icon" aria-hidden="true"><ClipboardCheck /></span>
            <div className="pc-row-body">
              <h3 className="pc-row-title break-words">{session.typeName ?? "Swim School Assessment"}</h3>
              <p className="pc-row-hint break-words">
                {[
                  formatTimeRange(session.startMinutes, session.startMinutes + session.durationMinutes),
                  session.programmeName,
                  session.location || "Pool",
                  session.instructor?.name ?? "Assessor not assigned",
                  `${session.booked} booked${session.capacity === null ? "" : ` of ${plural(session.capacity, "place")}`}`,
                ].join(" · ")}
              </p>
            </div>
            <div className="pc-row-trail">
              {canRun ? (
                <Button asChild>
                  <Link href={instructorAssessmentHref(session.id, params)} aria-label={`Open assessment: ${session.typeName ?? session.programmeName}, ${formatTime(session.startMinutes)}`}>
                    Open assessment<ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : <p className="pc-row-hint">Ask a manager for access to run assessments.</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
