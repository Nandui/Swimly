import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateRange, formatTimeRange } from "@/lib/format";
import { AreaDialog, DutyDialog, RetireDialog, SessionDialog } from "@/modules/plan/features/setup/components/setup-dialogs";
import type { PlanSetupData } from "@/modules/plan/features/setup/server/data";
import { dutyColor, WEEKDAYS } from "@/modules/plan/shared/rules";
import { Circle } from "lucide-react";

/** Setup: the duties (the organisation's), and this site's areas and what's on, each with what it
 *  needs. Everyone with the plan can read it; Manage changes it. */
export function SetupView({ data }: { data: PlanSetupData }) {
  const { site, manage, duties, areas, departments, qualifications, sessions } = data;
  const qName = (id: string | null) => qualifications.find((q) => q.id === id)?.name;
  const dName = (id: string | null) => departments.find((d) => d.id === id)?.name;
  const dutyName = (id: string) => duties.find((d) => d.id === id)?.name ?? "A duty no longer on the list";
  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name;
  const wholes = areas.filter((a) => !a.parentId);
  const days = (w: number[]) => w.length === 7 ? "Every day" : w.length === 5 && w.every((d) => d < 5) ? "Weekdays" : w.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ");
  const newSession = { title: "", areaId: "", lanes: [], start: 9 * 60, end: 10 * 60, weekdays: [0, 1, 2, 3, 4], firstDay: data.today, lastDay: data.today, skipDays: [], note: "", needs: [] };

  return (
    <div className="flex flex-col gap-(--space-7)">
      {manage ? null : <Notice tone="info" title="Only someone who manages the plan here can change the setup." />}

      <section aria-labelledby="plan-duties" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-duties">Duties</h2>
          {manage ? <DutyDialog draft={{ name: "", departmentId: "", qualificationTypeId: "", color: "blue", defaultMinutes: null, isBreak: false, forClasses: false, tasks: [] }}
            departments={departments} qualifications={qualifications} trigger={<Button variant="outline" className="min-h-11"><Plus aria-hidden="true" />Add a duty</Button>} /> : null}
        </div>
        {duties.length === 0 ? <EmptyState compact icon="clipboardList" title="No duties yet" hint="Start with the ones every day needs: Lifeguard, Reception, Break." /> : (
          <ul className="pc-list">
            {duties.map((d) => (
              <li key={d.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{d.name}</span>
                  <span className="pc-row-hint">{[d.isBreak ? "Break" : null, d.forClasses ? "Classes need it" : null, dName(d.departmentId), qName(d.qualificationTypeId) ? `Needs ${qName(d.qualificationTypeId)}` : null,
                    d.tasks.length ? `${d.tasks.length} task${d.tasks.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "Anyone"}</span>
                </span>
                <span className="pc-row-trail">
                  <Tag meta={{ label: d.name, color: dutyColor(d.color), icon: Circle }} />
                  {manage ? <>
                    <DutyDialog draft={{ ...d, departmentId: d.departmentId ?? "", qualificationTypeId: d.qualificationTypeId ?? "" }} departments={departments} qualifications={qualifications}
                      trigger={<Button variant="outline" className="min-h-11">Change</Button>} />
                    <RetireDialog kind="duty" id={d.id} name={d.name} />
                  </> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="plan-areas" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-areas">Areas at {site.name}</h2>
          {manage ? <AreaDialog siteId={site.id} draft={{ name: "", parentId: "", lanes: 0, departmentId: "" }} wholes={wholes} departments={departments}
            trigger={<Button variant="outline" className="min-h-11"><Plus aria-hidden="true" />Add an area</Button>} /> : null}
        </div>
        {areas.length === 0 ? <EmptyState compact icon="building" title="No areas yet" hint="Add the whole areas first (Pool), then their parts (Main pool, Learner pool)." /> : (
          <ul className="pc-list">
            {areas.map((a) => (
              <li key={a.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{a.parentId ? `${areaName(a.parentId)} › ${a.name}` : a.name}</span>
                  <span className="pc-row-hint">{[a.lanes ? `${a.lanes} lanes` : null, dName(a.departmentId) ?? "Shared"].filter(Boolean).join(" · ")}</span>
                </span>
                {manage ? <span className="pc-row-trail">
                  <AreaDialog siteId={site.id} draft={{ ...a, parentId: a.parentId ?? "", departmentId: a.departmentId ?? "" }} wholes={wholes} departments={departments}
                    trigger={<Button variant="outline" className="min-h-11">Change</Button>} />
                  <RetireDialog kind="area" id={a.id} name={a.name} />
                </span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="plan-whats-on" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="plan-whats-on">What&apos;s on at {site.name}</h2>
          {manage ? <SessionDialog siteId={site.id} draft={newSession} areas={areas} duties={duties.filter((d) => !d.isBreak)}
            trigger={<Button variant="outline" className="min-h-11"><Plus aria-hidden="true" />Add what&apos;s on</Button>} /> : null}
        </div>
        {sessions.length === 0 ? <EmptyState compact icon="calendarDays" title="Nothing on yet" hint="Add what needs staff, such as Pool open with 2 lifeguards. Swim classes come from Swim school by themselves." /> : (
          <ul className="pc-list">
            {sessions.map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{s.title}</span>
                  <span className="pc-row-hint">{[formatTimeRange(s.start, s.end), days(s.weekdays), formatDateRange(s.firstDay, s.lastDay),
                    areaName(s.areaId) ? `${areaName(s.areaId)}${s.lanes.length ? `, lanes ${s.lanes.join(", ")}` : ""}` : null].filter(Boolean).join(" · ")}</span>
                  <span className="pc-row-hint">{s.needs.length ? `Needs ${s.needs.map((n) => `${n.count} ${dutyName(n.dutyId)}`).join(", ")}` : "Needs nobody extra"}</span>
                </span>
                {manage ? <span className="pc-row-trail">
                  <SessionDialog siteId={site.id} draft={{ ...s, areaId: s.areaId ?? "" }} areas={areas} duties={duties.filter((d) => !d.isBreak)}
                    trigger={<Button variant="outline" className="min-h-11">Change</Button>} />
                  <RetireDialog kind="session" id={s.id} name={s.title} />
                </span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
