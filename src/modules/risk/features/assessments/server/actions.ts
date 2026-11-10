"use server";

import { revalidatePath } from "next/cache";
import { livePositionsOf, liveSiteById, sitesByIds } from "@/lib/directory";
import { today } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { siteChoices } from "@/modules/risk/features/assessments/server/data";
import { requireAt, requireRiskActor } from "@/modules/risk/shared/access";
import { changedDetails, createSchema, editSchema, MOVE_NEEDS, moveChange, moveSchema, nextReviewFor, problemOf, RiskError, type CreateInput, type DetailFields, type EditInput, type MoveInput } from "@/modules/risk/shared/rules";
import { alreadyDone, lockAssessment, nextReference, recordStep, sameSubject } from "@/modules/risk/shared/service";
import { riskStep } from "@/modules/risk/shared/step";
import { SUBJECT_LABEL, type RiskResult } from "@/modules/risk/shared/types";

type Previous = { subjectType: string; subject: string; departmentId: string | null; ownerId: string | null; ownerName: string };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The details as they will be kept, or why they cannot be: an area comes from the site's areas
 *  and a job from the organisation's positions (an activity is typed); the department is one the
 *  site uses; the owner is someone at the site who writes risk assessments. What an assessment
 *  already holds is always allowed to stay, so one brought over from the old app can be changed
 *  without first renaming everything in it. */
async function settled(orgId: string | null, siteId: string, f: DetailFields, previous?: Previous) {
  if (f.assessedOn > today()) throw new RiskError("The assessment day cannot be in the future.");
  const kept = !!previous && previous.subjectType === f.subjectType && same(previous.subject, f.subject);
  const choices = await siteChoices(orgId, siteId);
  let subject = f.subject;
  if (!kept && f.subjectType !== "activity") {
    const names = f.subjectType === "area" ? choices.areas : (await livePositionsOf(orgId)).map((p) => p.name);
    const match = names.find((n) => same(n, f.subject));
    if (!match) throw new RiskError(f.subjectType === "area" ? "Choose an area from the site’s list. Areas are kept in Admin, under Areas." : "Choose a job from the list. Positions are kept in Admin, under Positions.");
    subject = match;
  }
  if (f.departmentId && f.departmentId !== previous?.departmentId && !choices.departments.some((d) => d.id === f.departmentId)) throw new RiskError("Choose a department this site uses.");
  const owner = f.ownerId ? choices.owners.find((p) => p.id === f.ownerId) : null;
  if (f.ownerId && !owner && f.ownerId !== previous?.ownerId) throw new RiskError("Choose an owner from the list: someone at this site whose role writes risk assessments.");
  return { ...f, subject, departmentId: f.departmentId || null, ownerId: f.ownerId || null, ownerName: owner?.name ?? (f.ownerId ? previous?.ownerName ?? "" : "") };
}

const taken = (type: DetailFields["subjectType"], reference: string) => new RiskError(`This ${SUBJECT_LABEL[type].toLowerCase()} already has an assessment at this site (${reference}). Change that one, or archive it first.`);

/** Start a draft at a site: needs `risk.write` there. It takes the site's next reference. One
 *  thing has one live assessment at a site. Sending the same form twice saves once (the form's
 *  id and operation id). Audited with its history row. */
export async function createAssessment(input: CreateInput): Promise<RiskResult> {
  const who = await requireRiskActor();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, siteId, ...rest } = parsed.data;
  if (!(await mayFor("risk.write", { siteId, orgId: who.orgId }))) return { ok: false, error: "Your role cannot write risk assessments at that site." };
  const live = await liveSiteById(siteId);
  if (!live || (who.orgId && live.orgId !== who.orgId)) return { ok: false, error: "Choose one of your sites." };
  const site = { ...live, code: (await sitesByIds([siteId])).get(siteId)?.code ?? null };
  const orgId = live.orgId ?? who.orgId ?? "";
  try {
    const fields = await settled(who.orgId, siteId, rest);
    await prisma.$transaction(async (tx) => {
      await lockAssessment(tx, id);
      if (await tx.riskAssessment.findUnique({ where: { id }, select: { id: true } })) {
        if (await alreadyDone(tx, id, operationId, who, "create")) return;
        throw new RiskError("This assessment was already started. Refresh the page.");
      }
      const reference = await nextReference(tx, orgId, site);
      const clash = await sameSubject(tx, { id, orgId, siteId, subjectType: fields.subjectType, subject: fields.subject });
      if (clash) throw taken(fields.subjectType, clash.reference);
      const row = await tx.riskAssessment.create({
        data: { id, orgId, siteId, reference, ...fields, status: "draft", nextReviewOn: nextReviewFor({ ...fields, lastReviewedOn: null }), createdById: who.id, createdByName: who.name },
      });
      await recordStep(tx, row, who, "create", operationId);
    });
  } catch (error) {
    if (error instanceof RiskError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/risk-assessments", "layout");
  return { ok: true, id };
}

/** Change an assessment's details. One that was signed off loses its sign-off and waits for it
 *  again: what was signed is no longer what it says. */
export async function editAssessment(input: EditInput): Promise<RiskResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, ...rest } = parsed.data;
  // The choices are read before the assessment is locked; the version check then refuses the
  // edit if the assessment changed in between.
  const who = await requireRiskActor();
  const seen = await prisma.riskAssessment.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  let fields: Awaited<ReturnType<typeof settled>>;
  try {
    await requireAt(who, seen, "risk.write");
    fields = await settled(who.orgId, seen!.siteId, rest, seen!);
  } catch (error) {
    if (error instanceof RiskError) return { ok: false, error: error.message };
    throw error;
  }
  return riskStep({ id, operationId, version, action: "edit", needs: "risk.write", content: true }, async (row, _who, tx) => {
    const changed = changedDetails({ ...row, departmentId: row.departmentId ?? "", ownerId: row.ownerId ?? "", subjectType: row.subjectType as DetailFields["subjectType"] }, { ...fields, departmentId: fields.departmentId ?? "", ownerId: fields.ownerId ?? "" });
    if (!changed.length) throw new RiskError("Nothing has changed.");
    const clash = await sameSubject(tx, { id, orgId: row.orgId, siteId: row.siteId, subjectType: fields.subjectType, subject: fields.subject });
    if (clash) throw taken(fields.subjectType, clash.reference);
    return { data: { ...fields, nextReviewOn: nextReviewFor({ ...fields, lastReviewedOn: row.lastReviewedOn }) }, note: `Changed: ${changed.join(", ")}` };
  });
}

/** Send a draft for sign-off, sign it off or withdraw that (its owner), give or withdraw the
 *  executive sign-off (someone else, with that tick), archive it or bring it back (Manage). */
export async function moveAssessment(input: MoveInput): Promise<RiskResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, move, note } = parsed.data;
  return riskStep({ id, operationId, version, action: move, needs: MOVE_NEEDS[move] }, async (row, who, tx) => {
    const hazards = await tx.riskHazard.count({ where: { assessmentId: id, removedAt: null } });
    const data = moveChange({ ...row, hazards }, move, note, who, new Date());
    if (move === "restore") {
      const clash = await sameSubject(tx, row);
      if (clash) throw new RiskError(`Another assessment now covers this at the site (${clash.reference}). Archive that one first.`);
    }
    return { data, note };
  });
}
