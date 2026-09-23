"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { can, AuthorizationError } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { logAudit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, type FollowUpInput } from "@/lib/enrolment/follow-up";
import { requireFollowUpAccess, readFollowUpHistory } from "@/lib/enrolment/data/follow-up";

const schema = z.object({
  studentId: z.string().min(1).max(100), operationId: z.string().uuid(), expectedLatest: z.number().int().positive().nullable(),
  channel: z.enum(Object.keys(CONTACT_CHANNELS) as [keyof typeof CONTACT_CHANNELS, ...Array<keyof typeof CONTACT_CHANNELS>]),
  outcome: z.enum(Object.keys(CONTACT_OUTCOMES) as [keyof typeof CONTACT_OUTCOMES, ...Array<keyof typeof CONTACT_OUTCOMES>]),
  note: z.string().trim().min(1, "Add a note about the contact or work completed.").max(3000, "Keep the note to 3,000 characters."),
  occurredOn: z.string().refine(isDateOnly, "Enter a valid contact date."),
  nextContactOn: z.string().refine(value => value === "" || isDateOnly(value), "Enter a valid follow-up date."),
});

export async function getFollowUpHistory(studentId: string, before?: number) {
  return readFollowUpHistory(studentId, before);
}

export async function addFollowUp(input: FollowUpInput): Promise<ActionResult> {
  const actor = await requireFollowUpAccess();
  if (!can(actor, "enrolment.manage")) throw new AuthorizationError("You do not have permission to record enrolment follow-ups.");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.occurredOn > today()) return fail("The contact date cannot be in the future.");
  if (data.nextContactOn && data.nextContactOn < data.occurredOn) return fail("The next follow-up cannot be before the contact date.");
  const clubId = await currentClubId();
  const result = await prisma.$transaction(async tx => {
    // One swimmer lock protects the latest outcome and makes retries idempotent.
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${data.studentId} FOR UPDATE`;
    const prior = await tx.studentFollowUp.findUnique({ where: { studentId_operationId: { studentId: data.studentId, operationId: data.operationId } } });
    if (prior) {
      const same = prior.actorId === actor.user.id && prior.channel === data.channel && prior.outcome === data.outcome && prior.note === data.note && prior.occurredOn.getTime() === parseDateOnly(data.occurredOn).getTime() && (prior.nextContactOn?.getTime() ?? null) === (data.nextContactOn ? parseDateOnly(data.nextContactOn).getTime() : null);
      return same ? ok() : fail("This save was already used for another entry. Refresh the history before adding a new update.");
    }
    const student = await tx.student.findUnique({ where: { id: data.studentId }, select: { id: true } });
    if (!student) return fail("That swimmer is no longer available.");
    const latest = await tx.studentFollowUp.findFirst({ where: { studentId: data.studentId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    if ((latest?.sequence ?? null) !== data.expectedLatest) return fail("A colleague has added an update. Reload the history, review it, then save your note again.");
    const club = await tx.club.findUnique({ where: { id: clubId }, select: { name: true } });
    if (!club) return fail("Choose a working site before saving.");
    const row = await tx.studentFollowUp.create({ data: {
      studentId: data.studentId, operationId: data.operationId, actorId: actor.user.id, actorName: actor.user.name ?? "Staff member",
      clubId, clubName: club.name, channel: data.channel, outcome: data.outcome, note: data.note,
      occurredOn: parseDateOnly(data.occurredOn), nextContactOn: data.nextContactOn ? parseDateOnly(data.nextContactOn) : null,
    } });
    await logAudit({ actorId: actor.user.id, actorName: actor.user.name ?? "Staff member", entity: "Student", entityId: data.studentId, action: "enrolment-follow-up", clubId: null,
      summary: `Recorded enrolment follow-up: ${CONTACT_OUTCOMES[data.outcome].label}`, details: { followUpId: row.id, channel: data.channel, outcome: data.outcome, note: data.note, occurredOn: data.occurredOn, nextContactOn: data.nextContactOn || null, workingSite: club.name } }, tx);
    return ok();
  });
  if (result.ok) { revalidatePath("/awaiting-enrolment"); revalidatePath(`/students/${data.studentId}`); }
  return result;
}
