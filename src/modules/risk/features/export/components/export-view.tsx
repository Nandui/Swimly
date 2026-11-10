import type { ReactNode } from "react";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import { HazardFacts, HazardHead } from "@/modules/risk/shared/components/hazard-card";
import type { RiskAssessmentData } from "@/modules/risk/shared/load";
import { riskBand } from "@/modules/risk/shared/rules";
import { OUTCOME_LABEL, reviewEvery, RISK_BAND_META, RISK_BAND_RANGE, RISK_BANDS, RISK_REQUEST_META, RISK_STATUS_META, SUBJECT_LABEL } from "@/modules/risk/shared/types";

const day = (iso: string) => formatDate(parseDateOnly(iso));
const scored = (score: number) => `${score}, ${RISK_BAND_META[riskBand(score)].label.toLowerCase()}`;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="pc-panel">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** Label and value pairs, in two columns where there is room. */
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0 space-y-1">
          <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line">{value || "None"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The whole of one assessment, laid out to print or save as a PDF: its details and sign-off,
 *  how risk is scored, every hazard, the reviews and the review requests. */
export function ExportView({ data, exportedAt, exportedBy }: { data: RiskAssessmentData; exportedAt: Date; exportedBy: string }) {
  const { assessment: a, hazards, reviews, requests } = data;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ui-muted-foreground">{`${a.reference} as held in Turnfin on ${formatDateTime(exportedAt)}, opened by ${exportedBy}.`}</p>

      <Section id="exp-assessment" title="The assessment">
        <Facts rows={[
          [SUBJECT_LABEL[a.subjectType], a.subject],
          ["Site", a.siteName],
          ["Status", RISK_STATUS_META[a.status].label],
          ["Owner", a.ownerName || "Not chosen"],
          ["Department", a.departmentName],
          ["Assessed", `${day(a.assessedOn)}${a.assessorName ? ` by ${a.assessorName}` : ""}`],
          ["Reviewed", reviewEvery(a.reviewMonths)],
          ["Last reviewed", a.lastReviewedOn ? day(a.lastReviewedOn) : "Not yet"],
          ["Next review", a.status === "approved" ? day(a.nextReviewOn) : "Starts once it is in force"],
          ["Target risk", scored(a.targetScore)],
          ["Risk with controls in place", data.overall === null ? "No hazards" : `${scored(data.overall)}, across ${hazards.length} ${hazards.length === 1 ? "hazard" : "hazards"}`],
          ["Signed off by its owner", a.ownerApprovedAt ? `${a.ownerApprovedByName}, ${formatDateTime(new Date(a.ownerApprovedAt))}` : "Not signed off"],
          ["Executive sign-off", a.execApprovedAt ? `${a.execApprovedByName}, ${formatDateTime(new Date(a.execApprovedAt))}` : "Not given"],
          ["What it covers", a.scope],
        ]} />
      </Section>

      <Section id="exp-scale" title="How risk is scored">
        <p className="text-sm">Each hazard is rated for likelihood and for severity, 1 to 5 each. The two multiplied give its risk, 1 to 25, before any controls and again with the controls in place.</p>
        <Facts rows={RISK_BANDS.map((band) => [RISK_BAND_META[band].label, RISK_BAND_RANGE[band]])} />
      </Section>

      <section aria-labelledby="exp-hazards" className="flex min-w-0 flex-col gap-3">
        <h2 id="exp-hazards" className="text-lg font-semibold">{`Hazards (${hazards.length})`}</h2>
        {hazards.length === 0 ? <p className="text-sm">No hazards recorded.</p> : (
          <ol className="flex min-w-0 flex-col gap-3">
            {hazards.map((h) => (
              <li key={h.id} className="rec-card break-inside-avoid">
                <HazardHead hazard={h} />
                <HazardFacts hazard={h} targetScore={a.targetScore} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <Section id="exp-reviews" title="Reviews carried out">
        {reviews.length === 0 ? <p className="text-sm">None logged.</p> : (
          <ol className="flex flex-col gap-2 text-sm">
            {reviews.map((r) => <li key={r.id} className="break-words whitespace-pre-line">{`${day(r.reviewedOn)} · ${OUTCOME_LABEL[r.outcome] ?? r.outcome} · ${r.reviewerName}${r.notes ? `\n${r.notes}` : ""}`}</li>)}
          </ol>
        )}
      </Section>

      {requests.length ? (
        <Section id="exp-requests" title="Review requests">
          <ol className="flex flex-col gap-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="break-words whitespace-pre-line">
                {`${formatDate(new Date(r.createdAt))} · ${r.requestedByName} · ${RISK_REQUEST_META[r.status].label}${r.hazardLabel ? ` · ${r.hazardLabel}` : ""}\n${r.notes}${r.resolutionNote ? `\nAnswer: ${r.resolutionNote}` : ""}`}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
