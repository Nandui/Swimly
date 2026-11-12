import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatShortDay } from "@/lib/format";
import { HandleStrike, semesterOf, STRIKE_CAUSE_META, STRIKE_STAGE_META, strikesPage, type StrikeStage, WithdrawStrike } from "@/modules/staffing/features/strikes";

export const metadata: Metadata = { title: "Strikes" };

const CAN: Record<StrikeStage, "run" | "supervise" | "manage"> = {
  not_counted: "run", informal_1: "run", informal_2: "supervise", formal_referral: "manage", serious_misconduct_referral: "manage",
};

/** Strikes at a site (BR-8): what is due, then each person's strikes this semester. Never a strike:
 *  an approved swap or absence, a properly reported sick day, an on-time exam absence. */
export default async function StaffingStrikesPage({ searchParams }: { searchParams: Promise<{ site?: string; semester?: string }> }) {
  const params = await searchParams;
  const data = await strikesPage(params.site, params.semester);
  if (!data) return <PageShell header={<PageHeader title="Strikes" />}><EmptyState title="No sites" hint="Staffing covers the sites your role works at." /></PageShell>;
  const { site, todo, people, semester, semesterLabel, semesters, allowed, today } = data;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Strikes" description={`At ${site.name}. Strikes count per semester and reset in September, January and May. 1: return-to-work chat. 2: signed note. 3: formal referral to HR. No call, no show: referral now.`} />}>
      <RecordSection id="stf-todo-h" title="To do" aside={todo.length ? <p>{todo.length}</p> : null}>
        {todo.length === 0 ? <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="Nothing due" /></div> : (
          <ul className="pc-list">
            {todo.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{s.name}{s.number ? `, strike ${s.number}` : ""}</span>
                  <span className="pc-row-hint">{STRIKE_CAUSE_META[s.cause].label} on {formatShortDay(s.occurredOn)} · {s.owner} · due {formatShortDay(s.dueOn)}{s.dueOn < today ? " (overdue)" : ""}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={STRIKE_STAGE_META[s.stage]} />
                  {allowed[CAN[s.stage]] ? <HandleStrike id={s.id} name={s.name} stage={s.stage} /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      <SegmentedLinks label="Semester" items={semesters.map((key) => ({ href: `/staffing/strikes?${new URLSearchParams({ site: site.id, semester: key })}`, label: semesterOf(`${key}-01`).label, current: key === semester }))} />

      <RecordSection id="stf-people-h" title={semesterLabel} aside={people.length ? <p>{people.length} people</p> : null} note="People with no strikes this semester get first offer of extra and holiday hours.">
        {people.length === 0 ? <div className="pc-list"><EmptyState compact icon="usersRound" title="No strikes this semester" /></div> : (
          <ul className="pc-list">
            {people.map((p) => (
              <li key={p.userId} className="pc-row flex-col items-stretch">
                <span className="pc-row-body">
                  <span className="pc-row-title">{p.name}: {p.counted} counted</span>
                  {p.strikes.map((s) => (
                    <span key={s.id} className="pc-row-hint flex flex-wrap items-center gap-2">
                      <span>{formatShortDay(s.occurredOn)}: {STRIKE_CAUSE_META[s.cause].label}{s.withdrawn ? " (withdrawn)" : ""}{s.handledAt ? ` · ${s.handledByName}: ${s.note}` : ""}{s.signedByBoth ? " · signed by both" : ""}</span>
                      <Tag meta={STRIKE_STAGE_META[s.stage]} />
                      {allowed.manage && !s.withdrawn ? <WithdrawStrike id={s.id} name={p.name} /> : null}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </PageShell>
  );
}
