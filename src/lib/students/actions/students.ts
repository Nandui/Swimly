"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** Swimmer changes require students.manage. Club ownership never changes. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const blankOr = (test: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || test.test(value), message);

const studentSchema = z.object({
  memberNumber: z.string().trim().max(40, "Keep the member number under 40 characters."),
  firstName: z.string().trim().min(1, "A first name is needed.").max(60),
  lastName: z.string().trim().min(1, "A last name is needed.").max(60),
  dateOfBirth: z.string().trim()
    .refine((value) => value === "" || isDateOnly(value), "Give a valid date of birth.")
    .refine((value) => value === "" || value <= today(), "The date of birth cannot be in the future."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  contactName: z.string().trim().max(120),
  contactEmail: blankOr(EMAIL, "That email address does not look right."),
  contactPhone: z.string().trim().max(40),
  emergencyName: z.string().trim().max(120),
  emergencyPhone: z.string().trim().max(40),
  emergencyRelationship: z.string().trim().max(60),
  medicalNotes: z.string().trim().max(2000),
  notes: z.string().trim().max(2000),
  photoConsent: z.boolean(),
});

export type StudentInput = z.infer<typeof studentSchema>;

function toData(input: StudentInput) {
  return {
    // Empty means "no number", not "an empty number" — the column is unique,
    // and a second empty string would collide with the first.
    memberNumber: input.memberNumber || null,
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth ? parseDateOnly(input.dateOfBirth) : null,
    status: input.status,
    contactName: input.contactName || null,
    contactEmail: input.contactEmail ? input.contactEmail.toLowerCase() : null,
    contactPhone: input.contactPhone || null,
    emergencyName: input.emergencyName || null,
    emergencyPhone: input.emergencyPhone || null,
    emergencyRelationship: input.emergencyRelationship || null,
    medicalNotes: input.medicalNotes || null,
    notes: input.notes || null,
    photoConsent: input.photoConsent,
  };
}

export type CreateStudentResult = { ok: true; studentId: string } | Extract<ActionResult, { ok: false }>;

export async function createStudent(input: StudentInput): Promise<CreateStudentResult> {
  const session = await requirePermission("students.manage");

  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);
  // The club being worked in. Never changed afterwards.
  const clubId = await currentClubId();

  const result = await onUniqueViolation(
    () => prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          ...data,
          clubId,
          photoConsentOn: data.photoConsent ? new Date() : null,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "create",
        entity: "Student",
        entityId: student.id,
        clubId,
        summary: `Added ${fullName(student)}`,
      }, tx);
      return { ok: true as const, studentId: student.id };
    }),
    `Member number ${data.memberNumber} already belongs to another swimmer.`
  );
  if (!result.ok) return result;

  revalidatePath("/reception");
  revalidatePath("/students");
  return result;
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult> {
  const session = await requirePermission("students.manage");

  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);
  const clubId = await currentClubId();

  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    // Enrolment takes this row lock too, so deactivation cannot race a new place.
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.student.findUnique({ where: { id, clubId } });
    if (!existing) return fail("That swimmer no longer exists.");
    if (data.status === "INACTIVE" && existing.status !== "INACTIVE") {
      const active = await tx.enrolment.count({ where: { studentId: id, status: "ACTIVE" } });
      if (active > 0) return fail(`This swimmer is still enrolled in ${active} ${active === 1 ? "class" : "classes"}. End those enrolments first.`);
    }

    // Diff old against new and name the fields that moved. "Student updated"
    // tells a person reading this in six months nothing at all.
    const changes: string[] = [];
    const named: [keyof typeof data, string][] = [
      ["memberNumber", "member number"],
      ["firstName", "first name"],
      ["lastName", "last name"],
      ["status", "status"],
      ["contactName", "contact"],
      ["contactEmail", "contact email"],
      ["contactPhone", "contact phone"],
      ["emergencyName", "emergency contact"],
      ["emergencyPhone", "emergency phone"],
      ["emergencyRelationship", "emergency relationship"],
    ];
    for (const [key, label] of named) {
      const before = existing[key] ?? "";
      const after = data[key] ?? "";
      if (before !== after) {
        changes.push(after === "" ? `${label} cleared` : `${label} ${before || "—"} → ${after}`);
      }
    }
    if ((existing.dateOfBirth?.toISOString() ?? "") !== (data.dateOfBirth?.toISOString() ?? "")) {
      changes.push("date of birth");
    }
    if ((existing.medicalNotes ?? "") !== (data.medicalNotes ?? "")) changes.push("medical notes");
    if ((existing.notes ?? "") !== (data.notes ?? "")) changes.push("notes");
    if (existing.photoConsent !== data.photoConsent) {
      changes.push(`photo consent ${data.photoConsent ? "given" : "withdrawn"}`);
    }
    if (changes.length === 0) return ok();

    const student = await tx.student.update({
      where: { id },
      data: {
        ...data,
        // The date is the point of the consent record: "yes, on the 3rd" is
        // answerable, "yes" is not.
        photoConsentOn:
          existing.photoConsent === data.photoConsent
            ? existing.photoConsentOn
            : data.photoConsent
              ? new Date()
              : null,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (changes.length > 0) {
      await logAudit({
        actorId: session.user.id,
        actorName: session.user.name ?? "Unknown",
        action: "update",
        entity: "Student",
        entityId: id,
        clubId,
        summary: `Updated ${fullName(student)} (${changes.join(", ")})`,
      }, tx);
    }
    return ok();
  }), `Member number ${data.memberNumber} already belongs to another swimmer.`);
  if (!result.ok) return result;

  revalidatePath("/reception");
  revalidatePath("/students");
  revalidatePath("/students/[id]", "page");
  return ok();
}

/** Deactivation, not deletion. It is reversible, it keeps the attendance and
 *  assessment history readable, and it is what "left the club" actually means. */
export async function setStudentStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<ActionResult> {
  const session = await requirePermission("students.manage");
  const parsed = z.enum(["ACTIVE", "INACTIVE"]).safeParse(status);
  if (!parsed.success) return fail("Pick an active or inactive status.");
  const clubId = await currentClubId();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.student.findUnique({
      where: { id, clubId },
      select: { id: true, firstName: true, lastName: true, status: true },
    });
    if (!existing) return fail("That swimmer no longer exists.");
    if (existing.status === status) return ok();

    if (status === "INACTIVE") {
      const active = await tx.enrolment.count({ where: { studentId: id, status: "ACTIVE" } });
      if (active > 0) {
        return fail(
          `${fullName(existing)} is still enrolled in ${active} ${active === 1 ? "class" : "classes"}. End ${active === 1 ? "it" : "them"} first.`
        );
      }
    }

    await tx.student.update({ where: { id }, data: { status } });

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "Student",
      entityId: id,
      clubId,
      summary: `Marked ${fullName(existing)} ${status === "ACTIVE" ? "active" : "inactive"}`,
    }, tx);
    return ok();
  });
  if (!result.ok) return result;

  revalidatePath("/reception");
  revalidatePath("/students");
  revalidatePath("/students/[id]", "page");
  return ok();
}
