import { EmptyState } from "@/components/ui-kit/empty-state";
import { RecordSection } from "@/components/ui-kit/record";
import { HazardTools } from "@/modules/risk/features/hazards/components/hazard-tools";
import { HazardFacts, HazardHead } from "@/modules/risk/shared/components/hazard-card";
import type { RiskAssessmentData } from "@/modules/risk/shared/load";

/** An assessment's hazards, in order, each a card; writers add, change and remove them here. */
export function HazardSection({ data }: { data: RiskAssessmentData }) {
  const { assessment: a, hazards, can } = data;
  const on = { assessmentId: a.id, version: a.version, signed: a.status === "approved" || !!a.ownerApprovedAt };
  return (
    <RecordSection id="risk-hazards-h" title="Hazards" aside={<>{hazards.length ? <p>{hazards.length}</p> : null}{can.write ? <HazardTools on={on} /> : null}</>}
      note="Each hazard is rated twice, likelihood times severity: before any controls, and with the controls in place.">
      {hazards.length === 0 ? (
        <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="No hazards yet" hint={can.write ? "Add what could cause harm here, one hazard at a time." : "Its hazards will appear here."} /></div>
      ) : (
        <ol className="flex min-w-0 flex-col gap-3">
          {hazards.map((h) => (
            <li key={h.id} className="rec-card break-inside-avoid">
              <HazardHead hazard={h} />
              <HazardFacts hazard={h} targetScore={a.targetScore} />
              {can.write ? <HazardTools on={on} hazard={h} /> : null}
            </li>
          ))}
        </ol>
      )}
    </RecordSection>
  );
}
