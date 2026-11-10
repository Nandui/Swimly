import { RecordFacts } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { riskBand, riskScore } from "@/modules/risk/shared/rules";
import { CATEGORY_LABEL, LIKELIHOOD_LABELS, RISK_BAND_META, SEVERITY_LABELS, type RiskHazardView } from "@/modules/risk/shared/types";

/** How a hazard reads wherever it is shown: on its assessment and on the printed record. */

const rated = (likelihood: number, severity: number) =>
  `${riskScore(likelihood, severity)}: likelihood ${likelihood} (${LIKELIHOOD_LABELS[likelihood - 1]?.toLowerCase()}) × severity ${severity} (${SEVERITY_LABELS[severity - 1]?.toLowerCase()})`;

/** One hazard's facts: who it could harm, the risk before controls, the controls and what is left. */
export function HazardFacts({ hazard: h, targetScore }: { hazard: RiskHazardView; targetScore: number }) {
  return (
    <RecordFacts items={[
      ["Who could be harmed", h.personsAtRisk.join(", ") || "Not recorded"],
      ...(h.riskFactor ? [["What makes it a risk", h.riskFactor, true] as [string, string, boolean]] : []),
      ...(h.consequence ? [["What could happen", h.consequence, true] as [string, string, boolean]] : []),
      ["Before any controls", rated(h.inherentLikelihood, h.inherentSeverity)],
      ["Controls in place", h.controls || "None recorded", true],
      ["With the controls", `${rated(h.likelihood, h.severity)}. ${h.score <= targetScore ? "Within the target" : "Above the target"} of ${targetScore}`],
      ...(h.furtherAction ? [["Still to do", h.furtherAction, true] as [string, string, boolean]] : []),
    ]} />
  );
}

/** The hazard's number and kind over its name, with its risk now as a tag. */
export function HazardHead({ hazard: h, as: Heading = "h3" }: { hazard: RiskHazardView; as?: "h3" | "h2" }) {
  const band = RISK_BAND_META[riskBand(h.score)];
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="rec-muted rec-small tabular-nums">{`${h.reference} · ${CATEGORY_LABEL[h.category]}`}</p>
        <Heading className="text-base font-semibold break-words">{h.hazard}</Heading>
      </div>
      <Tag meta={band} label={`${h.score}, ${band.label.toLowerCase()}`} />
    </div>
  );
}
