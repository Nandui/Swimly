import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime, formatShortDay } from "@/lib/format";
import { usualWeekText } from "@/lib/people/usual-week";
import { availabilityPage, CHECK_CHANGE_META, CONTRACT_FIT_META, CONTRACT_KIND_META, formatHours } from "@/modules/staffing/features/preferences";

export const metadata: Metadata = { title: "When staff can work" };

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** When staff can work (D35): the preference check's dates, and everyone on the rota at a site
 *  with the times they gave in Turnfin Me. A guide for building the next rota, never a limit. */
export default async function StaffingAvailabilityPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await availabilityPage((await searchParams).site);
  if (!data) return <PageShell header={<PageHeader title="When staff can work" />}><EmptyState title="No sites" hint="Staffing covers the sites your role works at." /></PageShell>;
  const { site, check, people, settings } = data;
  const { current, next } = check;
  const changed = people.filter((p) => p.change === "in_check").length;
  const short = people.filter((p) => p.fit?.short).length;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="When staff can work" description={`The times each person on the rota at ${site.name} gave in Turnfin Me. They guide the next rota you build and never limit it; shifts already published stay as they are.`} />}>
      {!current ? (
        <Notice tone="info" title={`First preference check: ${formatShortDay(next.opensOn)}`}
          description={`Staff get one line in their Turnfin Me email asking them to update their times by ${formatDateTime(next.closesAt)} if they have changed. No answer means no change.`} />
      ) : check.open ? (
        <Notice tone="info" title={`Preference check open until ${formatDateTime(current.closesAt)}`}
          description={`Staff were asked on ${formatShortDay(current.opensOn)}. No answer means no change, so there is nobody to chase.`} />
      ) : (
        <Notice tone={changed ? "warning" : "info"}
          title={changed ? `${changed} changed their times in the check that closed ${formatDateTime(current.closesAt)}` : `Nobody changed their times in the check that closed ${formatDateTime(current.closesAt)}`}
          description={`Use them in the next rota you publish. Next check: ${formatShortDay(next.opensOn)}.`} />
      )}
      {short ? <Notice tone="error" title={`${short} can't fit their contracted hours`} description="The times they gave leave too little room in the places here. The centre manager meets them; times cannot remove contracted hours." /> : null}
      <RecordSection id="stf-avail-h" title="On the rota" aside={people.length ? <p>{people.length}</p> : null}>
        {people.length === 0 ? <div className="pc-list"><EmptyState compact icon="users" title="Nobody on the rota here yet" hint="Add swim teachers and lifeguards under Set up, Staff." /></div> : (
          <ul className="pc-list">
            {people.map((p) => (
              <li key={p.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}</span>
                  <span className="pc-row-hint">{p.usual ? sentence(usualWeekText(p.usual)) : "Hasn't said yet: any time"}</span>
                  {p.fit?.short ? <span className="pc-row-hint">{`Room for ${formatHours(p.fit.fits)} of ${formatHours(p.contractMinutes ?? 0)} contracted a week`}</span> : null}
                  {p.changedAt ? <span className="pc-row-hint">{`Last changed ${formatShortDay(p.changedAt)}`}</span> : null}
                </span>
                <span className="pc-row-trail">
                  {p.fit?.short ? <Tag meta={CONTRACT_FIT_META.short} /> : null}
                  {p.change ? <Tag meta={CHECK_CHANGE_META[p.change]} /> : null}
                  <Tag meta={CONTRACT_KIND_META[p.contract]} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
      <p className="text-sm text-ui-muted-foreground">{`A check opens every ${settings.checkEveryWeeks} weeks. Outside a check, a change counts only for a real timetable change, such as a new semester.`}</p>
    </PageShell>
  );
}
