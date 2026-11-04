import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime, formatShortDay, minutesNow } from "@/lib/format";
import { AcceptSwap, AskSwap, type College, COLLEGE_META, DecideSwap, EXAM_OUTCOME_META, RecordExam, REQUEST_FLAG_META, requestsPage, SEASON_LABEL, type SeasonName, shiftLabel, SWAP_STATUS_META } from "@/modules/staffing/features/requests";

export const metadata: Metadata = { title: "Requests" };

/** Swaps and exam absences at a site (BR-5, BR-7), with the exam seasons' deadlines. */
export default async function StaffingRequestsPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await requestsPage((await searchParams).site);
  if (!data) return <PageShell header={<PageHeader title="Requests" />}><EmptyState title="No sites" hint="Staffing covers the sites your role works at." /></PageShell>;
  const { site, swaps, exams, seasons, ahead, people, others, settings, today } = data;
  const nowMin = minutesNow();
  const now = `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`;
  const candidates = people.map(({ id, name, contract, dateOfBirth, quals, contractMinutes, wantsMore, strikes }) => ({ id, name, contract, dateOfBirth, quals, contractMinutes, wantsMore, strikes }));
  const decide = swaps.filter((s) => s.status === "accepted");
  const looking = swaps.filter((s) => s.status === "open");
  const done = swaps.filter((s) => s.status !== "accepted" && s.status !== "open");
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Requests" description={`Swaps and exam absences at ${site.name}. A swap is the only way to hand over a shift; it stays with the person rostered until approved.`}
      actions={site.supervise ? <><RecordExam ahead={ahead} today={today} nowTime={now} /><AskSwap ahead={ahead} people={candidates} shifts={others} settings={settings} /></> : undefined} />}>
      <RecordSection id="stf-decide-h" title="Swaps to decide" aside={decide.length ? <p>{decide.length}</p> : null} note={`Within ${settings.swapApprovalHours} hours of being taken.`}>
        {decide.length === 0 ? <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="Nothing to decide" /></div> : (
          <ul className="pc-list">
            {decide.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{s.requester} to {s.taker}</span>
                  <span className="pc-row-hint">{shiftLabel(s.shift)} · asked {formatDateTime(s.requestedAt)}</span>
                </span>
                <span className="pc-row-trail">
                  {s.overdue ? <Tag meta={REQUEST_FLAG_META.overdue} /> : null}
                  {s.overLimit ? <Tag meta={REQUEST_FLAG_META.overLimit} /> : null}
                  {site.supervise ? <DecideSwap swapId={s.id} summary={`${s.requester} gives ${shiftLabel(s.shift)} to ${s.taker}.`} overLimit={s.overLimit}
                    warnings={s.takerWarnings} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      <RecordSection id="stf-looking-h" title="Looking for cover" aside={looking.length ? <p>{looking.length}</p> : null} note={`Expire ${settings.swapNoticeHours} hours before the shift; it then stays with the person rostered.`}>
        {looking.length === 0 ? <div className="pc-list"><EmptyState compact icon="usersRound" title="No open swaps" /></div> : (
          <ul className="pc-list">
            {looking.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-row-body"><span className="pc-row-title">{s.requester}</span><span className="pc-row-hint">{shiftLabel(s.shift)}{s.taker ? ` · offered to ${s.taker}` : ""}</span></span>
                <span className="pc-row-trail">
                  {s.overLimit ? <Tag meta={REQUEST_FLAG_META.overLimit} label={`Over ${settings.maxGiveaways} this block`} /> : null}
                  <Tag meta={SWAP_STATUS_META.open} />
                  {site.supervise ? <AcceptSwap swapId={s.id} shift={s.shift} requesterId={s.requesterId} people={candidates} shifts={others} settings={settings} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      <RecordSection id="stf-exams-h" title="Exam absences" aside={exams.length ? <p>{exams.length}</p> : null} note="Unpaid. A third short-notice clash in a semester is flagged to the centre manager.">
        {exams.length === 0 ? <div className="pc-list"><EmptyState compact icon="graduation" title="None recorded" /></div> : (
          <ul className="pc-list">
            {exams.map((e) => (
              <li key={e.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{e.person}</span>
                  <span className="pc-row-hint">Asked {formatDateTime(e.requestedAt)} · {e.noticeSentOn ? `notice sent ${formatShortDay(e.noticeSentOn)}` : "no college notice"} · by {e.decidedByName}{e.note ? ` · ${e.note}` : ""}</span>
                </span>
                <span className="pc-row-trail">{e.flagged ? <Tag meta={REQUEST_FLAG_META.thirdClash} /> : null}<Tag meta={EXAM_OUTCOME_META[e.outcome]} /></span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      <RecordSection id="stf-seasons-h" title="Exam seasons" note={`Exam absences are due ${settings.examDeadlineDays} days before a season starts, with the college's notice.`}>
        {seasons.length === 0 ? <div className="pc-list"><EmptyState compact icon="calendarDays" title="No seasons ahead" hint="A centre manager adds them under Set up." /></div> : (
          <ul className="pc-list">
            {seasons.map((x) => (
              <li key={x.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{COLLEGE_META[x.college as College].label} {SEASON_LABEL[x.name as SeasonName].toLowerCase()} exams</span>
                  <span className="pc-row-hint">{formatShortDay(x.startsOn)} to {formatShortDay(x.endsOn)} · absences due by {formatShortDay(x.deadline)}{x.confirmed ? "" : " · dates not confirmed"}</span>
                </span>
                <span className="pc-row-trail"><Tag meta={COLLEGE_META[x.college as College]} /></span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      {done.length ? (
        <RecordSection id="stf-done-h" title="Decided swaps" aside={<p>{done.length}</p>}>
          <ul className="pc-list">
            {done.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{s.requester}{s.taker ? ` to ${s.taker}` : ""}</span>
                  <span className="pc-row-hint">{shiftLabel(s.shift)}{s.decidedByName ? ` · by ${s.decidedByName}` : ""}{s.refusalReason ? ` · ${s.refusalReason}` : ""}{s.warnings.length ? ` · ${s.warnings.join(" ")}` : ""}</span>
                </span>
                <span className="pc-row-trail"><Tag meta={SWAP_STATUS_META[s.status]} /></span>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}
    </PageShell>
  );
}
