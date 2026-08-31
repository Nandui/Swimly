"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { parseDateOnly } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** Students are the data, not the rules, so these are manage tier: the front
 *  desk and the instructors both need them. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
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
  dateOfBirth: blankOr(ISO_DATE, "Give the date of birth as a date."),
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

export async function createStudent(input: StudentInput): Promise<ActionResult> {
  const session = await requirePermission("students.manage");

  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);

  const student = await onUniqueViolation(
    () =>
      prisma.student.create({
        data: { ...data, photoConsentOn: data.photoConsent ? new Date() : null },
        select: { id: true, firstName: true, lastName: true },
      }),
    `Member number ${data.memberNumber} already belongs to another swimmer.`
  );
  if ("ok" in student) return student;

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "create",
    entity: "Student",
    entityId: student.id,
    summary: `Added ${fullName(student)}`,
  });

  revalidatePath("/students");
  return ok();
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult> {
  const session = await requirePermission("students.manage");

  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = toData(parsed.data);

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) return fail("That student no longer exists.");

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

  const student = await onUniqueViolation(
    () =>
      prisma.student.update({
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
      }),
    `Member number ${data.memberNumber} already belongs to another swimmer.`
  );
  if ("ok" in student) return student;

  if (changes.length > 0) {
    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name ?? "Unknown",
      action: "update",
      entity: "Student",
      entityId: id,
      summary: `Updated ${fullName(student)} (${changes.join(", ")})`,
    });
  }

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

  const existing = await prisma.student.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
  if (!existing) return fail("That student no longer exists.");
  if (existing.status === status) return ok();

  if (status === "INACTIVE") {
    const active = await prisma.enrolment.count({ where: { studentId: id, status: "ACTIVE" } });
    if (active > 0) {
      return fail(
        `${fullName(existing)} is still enrolled in ${active} ${active === 1 ? "course" : "courses"}. End ${active === 1 ? "it" : "them"} first.`
      );
    }
  }

  await prisma.student.update({ where: { id }, data: { status } });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "update",
    entity: "Student",
    entityId: id,
    summary: `Marked ${fullName(existing)} ${status === "ACTIVE" ? "active" : "inactive"}`,
  });

  revalidatePath("/students");
  revalidatePath("/students/[id]", "page");
  return ok();
}
