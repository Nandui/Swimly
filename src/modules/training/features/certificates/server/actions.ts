"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { staffByIds } from "@/lib/directory";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { certificateUpload, liveQualificationTypeById, markCertificateDeclined, markCertificateVerified, recordQualification } from "@/lib/qualifications";

/** Checking a certificate someone uploaded in Turnfin Me. Needs
 *  `qualifications.manage` for that person, and never your own. Verifying
 *  records the qualification (verified by the checker); declining keeps the
 *  upload with the reason, which the person sees. Decided once. */

async function reviewable(id: string) {
  const row = await certificateUpload(id);
  if (!row) return { ok: false as const, error: "That certificate no longer exists." };
  try {
    const actor = await requireCapFor("qualifications.manage", { subjectUserId: row.userId, orgId: row.orgId });
    if (actor.id === row.userId) return { ok: false as const, error: "Someone else has to check your own certificate." };
    return { ok: true as const, actor, row };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, error: "You can only check certificates for the people your role covers." };
    throw error;
  }
}

const verifySchema = z.object({
  typeId: z.string().min(1, "Choose the qualification."),
  /** Only the expiry date is mandatory on a certificate (owner decision, 9 October 2026). */
  issuedOn: z.union([z.literal(""), z.string().refine(isDateOnly, "Use a date.")]),
  expiresOn: z.string().refine(isDateOnly, "Enter the expiry date on the certificate."),
  reference: z.string().trim().max(80),
});

export async function verifyCertificate(id: string, input: z.input<typeof verifySchema>): Promise<ActionResult> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const check = await reviewable(id);
  if (!check.ok) return fail(check.error);
  const { actor, row } = check;
  const result = await prisma.$transaction(async (tx) => {
    const type = await liveQualificationTypeById(parsed.data.typeId, row.orgId, tx);
    if (!type) return fail("That qualification is no longer offered.");
    const { issuedOn, expiresOn } = parsed.data;
    if (issuedOn && expiresOn < issuedOn) return fail("The expiry date is before the issue date.");
    const qualificationId = await recordQualification(tx, { orgId: row.orgId, userId: row.userId, typeId: type.id }, {
      issuedOn: issuedOn ? parseDateOnly(issuedOn) : null, expiresOn: parseDateOnly(expiresOn),
      reference: parsed.data.reference, note: "Certificate uploaded in Turnfin Me", verifiedById: actor.id, verifiedAt: new Date(),
    });
    if (!(await markCertificateVerified(tx, id, { typeId: type.id, qualificationId }, actor))) throw new Error("already decided");
    const person = (await staffByIds([row.userId], tx)).get(row.userId);
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "record-qualification", entity: "Qualification", entityId: qualificationId,
      summary: `Checked ${person?.name ?? "former staff"}'s ${type.name} certificate and recorded it${expiresOn ? `, valid until ${expiresOn}` : ""}` }, tx);
    return ok();
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "already decided") return fail("That certificate has already been checked.");
    throw error;
  });
  if (result.ok) revalidatePath("/training/certificates");
  return result;
}

export async function declineCertificate(id: string, note: string): Promise<ActionResult> {
  const reason = String(note ?? "").trim().slice(0, 500);
  if (reason.length < 3) return fail("Tell them briefly why, so they know what to send instead.");
  const check = await reviewable(id);
  if (!check.ok) return fail(check.error);
  const { actor, row } = check;
  const result = await prisma.$transaction(async (tx) => {
    if (!(await markCertificateDeclined(tx, id, reason, actor))) return fail("That certificate has already been checked.");
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "decline-certificate", entity: "Qualification", entityId: id, summary: "Declined an uploaded certificate", details: { subjectUserId: row.userId } }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/training/certificates");
  return result;
}
