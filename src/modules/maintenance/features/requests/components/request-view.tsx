import Link from "next/link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordHistory, RecordNext, RecordSection, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import { ManageActions } from "@/modules/maintenance/features/requests/components/manage-actions";
import type { getMaintenanceRequest } from "@/modules/maintenance/features/requests/server/data";
import { MAINTENANCE_ACTIONS, MAINTENANCE_STATUS_META, MAINTENANCE_URGENCY_META, maintenanceNumber, RISK_FACT, TRACKPLAN_LABEL, type MaintenanceAction, type MaintenanceView } from "@/modules/maintenance/shared/types";

type Data = Awaited<ReturnType<typeof getMaintenanceRequest>>;

/** Where it has got to: reported, in Trackplan, fixed. Closed without a fix stops at the step it
 *  was on; In Trackplan is skipped when it was fixed before anyone put it there. */
function steps(r: MaintenanceView, history: Data["history"]): { label: string; hint: string; state: RecordStepState }[] {
  const when = (action: MaintenanceAction) => { const e = [...history].reverse().find((h) => h.action === action); return e ? formatDate(new Date(e.createdAt)) : null; };
  const inTrackplan = r.trackplan === "yes";
  const closed = r.status === "closed";
  return [
    { label: "Reported", hint: `By ${r.reportedByName}, ${formatDate(new Date(r.createdAt))}`, state: r.status === "reported" ? "current" : "done" },
    { label: "In Trackplan", hint: inTrackplan ? (r.trackplanRef ? `Reference ${r.trackplanRef}` : when("trackplan") ?? "Already there when reported") : r.status === "reported" ? "A manager puts it there" : "Not recorded", state: r.status === "in_trackplan" ? "current" : inTrackplan ? "done" : r.status === "reported" ? "todo" : "skipped" },
    closed
      ? { label: "Closed, not fixed", hint: r.closedAt ? formatDate(new Date(r.closedAt)) : "", state: "stopped" }
      : { label: "Fixed", hint: r.status === "fixed" && r.closedAt ? formatDate(new Date(r.closedAt)) : "Not yet", state: r.status === "fixed" ? "done" : "todo" },
  ];
}
const historyTone = (a: MaintenanceAction) => (a === "fix" ? "done" as const : a === "reopen" ? "warn" as const : a === "close" ? "stop" as const : undefined);

function nextStep(r: MaintenanceView, manage: boolean) {
  if (r.status === "reported") return manage ? "Check it is in Trackplan, put it there if not, then record it here." : "A manager at the site will make sure the maintenance team has it in Trackplan.";
  if (r.status === "in_trackplan") return manage ? "The maintenance team has it in Trackplan. Mark it fixed once it is put right." : "The maintenance team has it in Trackplan. A manager marks it fixed once it is put right.";
  if (r.status === "fixed") return "Fixed. If the problem comes back, a manager can open it again.";
  return "Closed without a fix. Its history is kept.";
}

/** One maintenance request as a record page (ui-kit/record.tsx), as Refunds and Coinage are: what
 *  happens next and where it has got to beside it, tinted blue while the move is this person's;
 *  the problem, its photos (the photos feature, passed in by the route) and the history. */
export function RequestView({ data, areas, photos }: { data: Data; areas: string[]; photos: React.ReactNode }) {
  const r = data.request;
  const act = data.can.manage && (r.status === "reported" || r.status === "in_trackplan");
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/maintenance", label: "Maintenance" }}
        eyebrow={<p className="rec-head"><Tag meta={MAINTENANCE_STATUS_META[r.status]} />{r.urgency === "urgent" ? <Tag meta={MAINTENANCE_URGENCY_META.urgent} /> : null}<span className="tabular-nums">{maintenanceNumber(r.number)}</span></p>}
        title={r.title}
        description={`${[r.siteName, r.area].filter(Boolean).join(", ")} · reported by ${r.reportedByName}, ${formatDateTime(new Date(r.createdAt))}`} />}>
      <div className="rec-layout">
        <RecordNext act={act} label={act ? "Your move" : "Where it stands"} body={nextStep(r, data.can.manage)}>
          {data.can.manage ? <ManageActions request={r} candidates={data.candidates} areas={areas} /> : null}
          <RecordSteps steps={steps(r, data.history)} label="Where the request has got to" />
        </RecordNext>
        <div className="rec-main">
          <RecordSection id="mnt-problem-h" title="The problem">
            <div className="rec-card">
              <RecordFacts items={[
                ["Site", r.siteName],
                ["Area", r.area || "Not in one area"],
                ["Exactly where", r.place || "Not given"],
                ["Out of use or a risk", RISK_FACT[r.risk]],
                ["Urgency", MAINTENANCE_URGENCY_META[r.urgency].label],
                ["In Trackplan", TRACKPLAN_LABEL[r.trackplan]],
                ...(r.trackplanRef ? [["Trackplan reference", r.trackplanRef] as [string, string]] : []),
                ...(r.details ? [["Details", r.details, true] as [string, string, boolean]] : []),
              ]} />
            </div>
          </RecordSection>
          {r.status === "fixed" || r.status === "closed" ? (
            <RecordSection id="mnt-outcome-h" title={r.status === "fixed" ? "How it was put right" : "Why it was closed"}>
              <div className="rec-card">
                <RecordFacts items={[
                  [r.status === "fixed" ? "What was done" : "Reason", r.outcome || "Not given", true],
                  ...(r.duplicateOf ? [["Repeats", <Link key="dup" href={`/maintenance/${r.duplicateOf.id}`} className="underline-offset-4 hover:underline">{`${maintenanceNumber(r.duplicateOf.number)} · ${r.duplicateOf.title}`}</Link>] as [string, React.ReactNode]] : []),
                  ["Closed by", `${r.closedByName ?? "Unknown"}${r.closedAt ? `, ${formatDateTime(new Date(r.closedAt))}` : ""}`],
                ]} />
              </div>
            </RecordSection>
          ) : null}
          <RecordSection id="mnt-photos-h" title="Photos" aside={data.photos.length ? <p>{data.photos.length}</p> : undefined}>
            <div className="rec-card">{photos}</div>
          </RecordSection>
        </div>
        <div className="rec-side">
          <RecordSection id="mnt-history-h" title="History">
            <RecordHistory items={data.history.map((h) => ({ key: h.id, tone: historyTone(h.action), title: MAINTENANCE_ACTIONS[h.action] ?? h.action, meta: `${h.actorName} · ${formatDateTime(new Date(h.createdAt))}`, note: h.note }))} />
          </RecordSection>
        </div>
      </div>
    </PageShell>
  );
}
