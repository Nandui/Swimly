import type { Metadata } from "next";
import { PhoneCall } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { addDaysIso, formatDay, formatShortDay, formatTime, formatTimeRange, minutesNow } from "@/lib/format";
import { HandleStrike } from "@/modules/staffing/features/strikes";
import { ATTENDANCE_META, CoverPlace, LogAttendance, RoleTag, SHIFT_STATUS_META, type ShiftStatus, STRIKE_CAUSE_META, STRIKE_STAGE_META, type StrikeCause, todayPage } from "@/modules/staffing/features/today";

export const metadata: Metadata = { title: "Today" };

/** The duty manager's day (spec section 9, BR-6, BR-10): places to cover first, then every shift
 *  with what was logged, then the return-to-work chats due. */
export default async function StaffingTodayPage({ searchParams }: { searchParams: Promise<{ site?: string; day?: string }> }) {
  const params = await searchParams;
  const data = await todayPage(params.site, params.day);
  if (!data) return <PageShell header={<PageHeader title="Today" />}><EmptyState title="No sites" hint="Staffing covers the sites your role works at." /></PageShell>;
  const { site, day, shifts, needCover, people, others, settings, chats } = data;
  const isToday = day === data.today;
  const nowMin = minutesNow();
  const now = `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`;
  const candidates = people.map(({ id, name, contract, dateOfBirth, quals, contractMinutes, wantsMore, strikes }) => ({ id, name, contract, dateOfBirth, quals, contractMinutes, wantsMore, strikes }));
  const busy = shifts.filter((s) => s.userId).map((s) => s.userId!);
  const gaps = shifts.filter((s) => needCover.includes(s.id));
  const link = (d: string) => `/staffing/today?${new URLSearchParams({ site: site.id, day: d })}`;
  return (
    <PageShell spacing="roomy" header={<PageHeader title={isToday ? "Today" : formatDay(day)} description={`Every published shift at ${site.name}. Call-offs come by phone to the centre landline; log them here as they come in.`} />}>
      <SegmentedLinks label="Day" items={[-1, 0, 1, 2].map((n) => addDaysIso(data.today, n)).map((d) => ({ href: link(d), label: d === data.today ? "Today" : formatShortDay(d), current: d === day }))} />

      {gaps.length ? (
        <RecordSection id="stf-gaps-h" title="Needs cover" aside={<p>{gaps.length}</p>} note="Float first, then the cover list (15 minutes each), then the other centres, then merge within ratio, then the centre manager.">
          <ul className="pc-list">
            {gaps.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-tile-icon" data-tone="orange" aria-hidden="true"><PhoneCall /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{s.name} · {formatTimeRange(s.startMin, s.endMin)}</span>
                  <span className="pc-row-hint">{s.person ? `${s.person}: ${SHIFT_STATUS_META[s.status as ShiftStatus].label.toLowerCase()}` : "Nobody on this place"}</span>
                </span>
                <span className="pc-row-trail">
                  <RoleTag role={s.role} />
                  {site.run ? <CoverPlace shift={{ id: s.id, date: day, startMin: s.startMin, endMin: s.endMin, role: s.role, name: s.name }} people={candidates} settings={settings}
                    shifts={[...others, ...shifts.filter((x) => x.userId).map((x) => ({ id: x.id, userId: x.userId!, date: day, startMin: x.startMin, endMin: x.endMin, role: x.role }))]} exclude={busy.filter((id) => id === s.userId)} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}

      <RecordSection id="stf-shifts-h" title="Shifts" aside={<p>{shifts.length}</p>}>
        {shifts.length === 0 ? <div className="pc-list"><EmptyState compact icon="calendarCheck" title="No published shifts" hint="Shifts appear once their block is published." /></div> : (
          <ul className="pc-list">
            {shifts.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{s.person ?? <span className="text-ui-muted-foreground">Empty</span>}{s.coversId ? <span className="text-ui-muted-foreground"> (cover)</span> : null}</span>
                  <span className="pc-row-hint">{s.name} · {formatTimeRange(s.startMin, s.endMin)}</span>
                  {s.logs.length ? <span className="pc-row-hint">{s.logs.map((l) => `${ATTENDANCE_META[l.kind].label}${l.kind === "call_off" ? (l.onTime ? ", on time" : ", late") : ""}${l.minutesLate ? `, ${l.minutesLate} min` : ""}, logged by ${l.loggedBy} at ${formatTime(minutesNow(l.at))}`).join(" · ")}</span> : null}
                </span>
                <span className="pc-row-trail">
                  <RoleTag role={s.role} />
                  {s.userId ? <Tag meta={SHIFT_STATUS_META[s.status as ShiftStatus]} /> : null}
                  {site.run && s.userId && s.status === "scheduled" ? <LogAttendance shiftId={s.id} person={s.person!} shiftName={`${s.name}, ${formatTimeRange(s.startMin, s.endMin)}`} day={data.today} nowTime={now} settings={settings} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      {site.run ? (
        <RecordSection id="stf-chats-h" title="Return-to-work chats" aside={chats.length ? <p>{chats.length}</p> : null} note="Strike 1: informal counselling on their next shift.">
          {chats.length === 0 ? <div className="pc-list"><EmptyState compact icon="usersRound" title="None due" /></div> : (
            <ul className="pc-list">
              {chats.map((c) => (
                <li key={c.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{c.name}</span>
                    <span className="pc-row-hint">{STRIKE_CAUSE_META[c.cause as StrikeCause].label} · due {formatShortDay(c.dueOn)}</span>
                  </span>
                  <span className="pc-row-trail"><Tag meta={STRIKE_STAGE_META[c.stage]} /><HandleStrike id={c.id} name={c.name} stage={c.stage} /></span>
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      ) : null}
      {!isToday ? <Notice tone="info" title="Not today" description="Call-offs are logged with the day and time they came in, whichever day you are looking at." /> : null}
    </PageShell>
  );
}
