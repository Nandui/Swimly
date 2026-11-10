"use server";

import { addHazardSchema, editHazardSchema, hazardData, hazardReference, problemOf, removeHazardSchema, RiskError, type AddHazardInput, type EditHazardInput, type RemoveHazardInput } from "@/modules/risk/shared/rules";
import { riskStep } from "@/modules/risk/shared/step";
import type { RiskResult } from "@/modules/risk/shared/types";

/** Hazards on an assessment, for Write at its site. Each is a change to what was signed off, so an
 *  assessment in force loses its sign-off and waits for it again (shared/step.ts). A hazard's
 *  number is never used twice, and a removed hazard is hidden, never deleted. */

export async function addHazard(input: AddHazardInput): Promise<RiskResult> {
  const parsed = addHazardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { assessmentId: id, operationId, version, hazardId, ...fields } = parsed.data;
  return riskStep({ id, operationId, version, action: "hazard_add", needs: "risk.write", content: true }, async (row, _who, tx) => {
    const last = await tx.riskHazard.aggregate({ where: { assessmentId: id }, _max: { seq: true, sortOrder: true } });
    const seq = Math.max(row.hazardSeq, last._max.seq ?? 0) + 1;
    await tx.riskHazard.create({ data: { id: hazardId, orgId: row.orgId, assessmentId: id, seq, sortOrder: (last._max.sortOrder ?? 0) + 1, ...hazardData(fields) } });
    return { data: { hazardSeq: seq }, note: `${hazardReference(row.reference, seq)}: ${fields.hazard}` };
  });
}

export async function editHazard(input: EditHazardInput): Promise<RiskResult> {
  const parsed = editHazardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { assessmentId: id, operationId, version, hazardId, ...fields } = parsed.data;
  return riskStep({ id, operationId, version, action: "hazard_edit", needs: "risk.write", content: true }, async (row, _who, tx) => {
    const hazard = await tx.riskHazard.findFirst({ where: { id: hazardId, assessmentId: id, removedAt: null } });
    if (!hazard) throw new RiskError("This hazard is no longer on the assessment. Refresh the page.");
    const data = hazardData(fields);
    const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => data[k] !== hazard[k]);
    if (!changed.length) throw new RiskError("Nothing has changed.");
    await tx.riskHazard.update({ where: { id: hazardId }, data });
    const rated = data.score !== hazard.score ? ` Risk with controls: ${hazard.score} to ${data.score}.` : "";
    return { note: `${hazardReference(row.reference, hazard.seq)}: ${data.hazard}.${rated}` };
  });
}

export async function removeHazard(input: RemoveHazardInput): Promise<RiskResult> {
  const parsed = removeHazardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { assessmentId: id, operationId, version, hazardId } = parsed.data;
  return riskStep({ id, operationId, version, action: "hazard_remove", needs: "risk.write", content: true }, async (row, _who, tx) => {
    const hazard = await tx.riskHazard.findFirst({ where: { id: hazardId, assessmentId: id, removedAt: null } });
    if (!hazard) throw new RiskError("This hazard is no longer on the assessment. Refresh the page.");
    await tx.riskHazard.update({ where: { id: hazardId }, data: { removedAt: new Date() } });
    return { note: `${hazardReference(row.reference, hazard.seq)}: ${hazard.hazard}` };
  });
}
