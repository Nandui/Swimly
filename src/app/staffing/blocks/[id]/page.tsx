import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateRange, formatDateTime, formatDay, formatShortDay, formatTimeRange } from "@/lib/format";
import { ACK_STATE_META, AckButtons, AssignPlace, BLOCK_STATE_META, blockDays, blockPage, DeleteBlockDialog, fitWarnings, formatHours, HOURS_META, PublishDialog, RoleTag, SHIFT_STATUS_META, type ShiftStatus, Warnings } from "@/modules/staffing/features/blocks";

export const metadata: Metadata = { title: "Rota block" };

/** One rota block (spec section 9, Rota builder): a day at a time, each place with who is on it and
 *  their warnings; per-teacher hours against contract; then acknowledgements once published. */
export default async function StaffingBlockPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const data = await blockPage((await params).id);
  const { block, site, shifts, people, others, hours, acks, settings } = data;
  const days = blockDays(block.startsOn);
  const empty = (d: string) => shifts.filter((s) => s.date === d && !s.userId).length;
  const asked = (await searchParams).day;
  const open = asked && days.includes(asked) ? asked : days.find((d) => empty(d) > 0) ?? days[0];
  const published = !!block.publishedAt;
  const canChange = published ? site.manage : site.supervise;
  const everyone = [...others, ...shifts.filter((s) => s.userId).map((s) => ({ id: s.id, userId: s.userId!, date: s.date, startMin: s.startMin, endMin: s.endMin, role: s.role }))];
  const candidates = people.map(({ id, name, contract, dateOfBirth, quals, contractMinutes, wantsMore, strikes }) => ({ id, name, contract, dateOfBirth, quals, contractMinutes, wantsMore, strikes }));
  const today = shifts.filter((s) => s.date === open);
  const short = hours.filter((h) => h.short > 0);
  const filled = shifts.filter((s) => s.userId).length;
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: `/staffing?site=${site.id}`, label: "Rota blocks" }} title={formatDateRange(block.startsOn, block.endsOn)}
      eyebrow={<Tag meta={BLOCK_STATE_META[block.state]} />}
      description={published ? `Published at ${site.name} by ${block.publishedByName ?? "someone"}, ${formatDateTime(block.publishedAt!)}.` : `${site.name}. Publish by ${formatDateTime(block.deadline)}. ${filled} of ${shifts.length} places filled.`}
      actions={!published && site.supervise ? <><DeleteBlockDialog blockId={block.id} /><PublishDialog blockId={block.id} short={short.map((h) => ({ name: h.name, short: h.short }))} /></> : undefined} />}>
      {block.shortAccepted ? <Notice tone="info" title="Published with teachers below contracted hours" description={block.shortAccepted} /> : null}
      {published && !site.manage ? <Notice tone="info" title="This block is published" description="Its shifts change by a swap or an absence (Requests), or by a centre manager with a reason." /> : null}

      <SegmentedLinks label="Day of the block" items={days.map((d) => ({ href: `/staffing/blocks/${block.id}?day=${d}`, label: formatShortDay(d), count: empty(d) || undefined, current: d === open }))} />

      <RecordSection id="stf-day-h" title={formatDay(open)} aside={<p>{today.length} places</p>}>
        {today.length === 0 ? <div className="pc-list"><EmptyState compact icon="calendarRange" title="No slots this day" hint="The site's slots decide which days have places." /></div> : (
          <ul className="pc-list">
            {today.map((s) => {
              const person = s.userId ? people.find((p) => p.id === s.userId) : null;
              const warnings = person ? fitWarnings({ id: s.id, date: s.date, startMin: s.startMin, endMin: s.endMin, role: s.role }, { ...person, shifts: everyone.filter((x) => x.userId === person.id) }, settings) : [];
              return (
                <li key={s.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{s.person ?? <span className="text-ui-muted-foreground">Empty</span>}</span>
                    <span className="pc-row-hint">{s.name} · {formatTimeRange(s.startMin, s.endMin)}</span>
                    <Warnings warnings={warnings} />
                  </span>
                  <span className="pc-row-trail">
                    <RoleTag role={s.role} />
                    {s.status !== "scheduled" ? <Tag meta={SHIFT_STATUS_META[s.status as ShiftStatus]} /> : null}
                    {canChange && s.status === "scheduled" ? (
                      <AssignPlace shift={{ id: s.id, date: s.date, startMin: s.startMin, endMin: s.endMin, role: s.role, name: s.name }}
                        people={candidates} shifts={everyone} settings={settings} published={published} current={s.userId} />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </RecordSection>

      <RecordSection id="stf-hours-h" title="Hours against contract" aside={short.length ? <p>{short.length} below</p> : null}
        note="Each week of the block. Contracted hours are kept on the person's Staff page.">
        {hours.length === 0 ? <div className="pc-list"><EmptyState compact icon="users" title="No teachers yet" hint="Add teachers under Set up." /></div> : (
          <ul className="pc-list">
            {hours.map((h) => (
              <li key={h.userId} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{h.name}</span>
                  <span className="pc-row-hint">Week 1: {formatHours(h.weeks[0])} · Week 2: {formatHours(h.weeks[1])}{h.contract !== null ? ` · Contract ${formatHours(h.contract)} a week` : " · No contracted hours on record"}</span>
                </span>
                <span className="pc-row-trail">
                  {h.short > 0 ? <Tag meta={HOURS_META.short} label={`${formatHours(h.short)} short`} /> : h.contract !== null ? <Tag meta={HOURS_META.met} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      {published ? (
        <RecordSection id="stf-acks-h" title="Acknowledgements" aside={<p>{acks.filter((a) => a.acknowledgedAt).length} of {acks.length}</p>}
          note={`Within ${settings.ackHours} hours of publishing; a reminder at ${settings.ackReminderHours}. Shifts stand either way.`}>
          <ul className="pc-list">
            {acks.map((a) => (
              <li key={a.userId} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{a.name}</span>
                  <span className="pc-row-hint">{a.acknowledgedAt ? `Acknowledged ${formatDateTime(a.acknowledgedAt)}` : a.phonedAt ? `Phoned by ${a.phonedByName ?? "someone"}, ${formatDateTime(a.phonedAt)}` : "Not yet"}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={ACK_STATE_META[a.state]} />
                  {site.supervise ? <AckButtons blockId={block.id} userId={a.userId} name={a.name} acknowledged={!!a.acknowledgedAt} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </RecordSection>
      ) : null}
    </PageShell>
  );
}
