import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatShortDay } from "@/lib/format";
import { type College, COLLEGE_META, DeleteSeason, SEASON_LABEL, SeasonDialog, type SeasonName, seasonsPage } from "@/modules/staffing/features/setup";

export const metadata: Metadata = { title: "Exam seasons" };

/** Each college's exam seasons (BR-7.1), set each August for the year ahead. */
export default async function StaffingSeasonsPage() {
  const { who, seasons } = await seasonsPage();
  if (!who.manage) notFound();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Exam seasons" description="Each college's published exam periods. Staff ask for exam absences by the deadline, with the college's notice." actions={<SeasonDialog />} />}>
      <RecordSection id="stf-seasons-h" title="Seasons" aside={<p>{seasons.length}</p>}>
        {seasons.length === 0 ? <div className="pc-list"><EmptyState compact icon="calendarDays" title="No seasons yet" /></div> : (
          <ul className="pc-list">
            {seasons.map((x) => (
              <li key={x.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{COLLEGE_META[x.college as College].label} {SEASON_LABEL[x.name as SeasonName].toLowerCase()}</span>
                  <span className="pc-row-hint">{formatShortDay(x.startsOn)} to {formatShortDay(x.endsOn)}{x.firstYearStartsOn ? ` (first years from ${formatShortDay(x.firstYearStartsOn)})` : ""} · absences due by {formatShortDay(x.deadline)}{x.confirmed ? "" : " · not confirmed"}</span>
                </span>
                <span className="pc-row-trail"><Tag meta={COLLEGE_META[x.college as College]} /><DeleteSeason id={x.id} /><SeasonDialog season={x} /></span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </PageShell>
  );
}
