import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { onUniqueViolation } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, toDateOnlyString, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Member, MemberDirectory, MemberHit, NewMember } from "@/modules/contributions";
import { fullName } from "@/modules/activities/shared/students/constants";

/** The swimmer records as a directory other modules enrol from (owner request, 21 October 2026:
 *  short courses and Academy courses book people from the swimmer database). Registered in
 *  module.ts; callers check their own permission and say whether their viewer may read medical
 *  notes. The swim school still owns every write here, with its audit. */

const LIMIT = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "2015-03-04", "4/3/2015" or "04-03-2015" (day first, as written here) as an ISO date. */
export function dateTerm(term: string): string | null {
  if (isDateOnly(term)) return term;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(term);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isDateOnly(iso) ? iso : null;
}

function termWhere(term: string): Prisma.StudentWhereInput {
  const date = dateTerm(term);
  if (date) return { dateOfBirth: parseDateOnly(date) };
  return {
    OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { memberNumber: { contains: term, mode: "insensitive" } },
      { contactName: { contains: term, mode: "insensitive" } },
      { contactEmail: { contains: term, mode: "insensitive" } },
      ...(/\d{3}/.test(term) ? [{ contactPhone: { contains: term.replace(/\s/g, "") } }] : []),
    ],
  };
}

const HIT = { id: true, memberNumber: true, firstName: true, lastName: true, dateOfBirth: true, status: true, contactName: true } as const satisfies Prisma.StudentSelect;

function hitOf(row: Prisma.StudentGetPayload<{ select: typeof HIT }>): MemberHit {
  return { id: row.id, memberNumber: row.memberNumber, firstName: row.firstName, lastName: row.lastName,
    dateOfBirth: row.dateOfBirth ? toDateOnlyString(row.dateOfBirth) : null, active: row.status === "ACTIVE", contactName: row.contactName };
}

async function search(q: string): Promise<MemberHit[]> {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4);
  if (terms.length === 0 || terms.join("").length < 2) return [];
  const rows = await prisma.student.findMany({
    where: { AND: terms.map(termWhere) },
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    take: LIMIT * 3, select: HIT,
  });
  // As the swimmer picker: a person whose name or number starts with every word comes first.
  const leads = (row: (typeof rows)[number]) => {
    const words = [row.firstName, row.lastName, row.memberNumber ?? ""].map((w) => w.toLowerCase());
    return terms.every((term) => dateTerm(term) || words.some((w) => w.startsWith(term)));
  };
  return rows
    .map((row, index) => ({ row, index, lead: leads(row) ? 0 : 1 }))
    .sort((a, b) => a.lead - b.lead || a.index - b.index)
    .slice(0, LIMIT)
    .map((entry) => hitOf(entry.row));
}

async function byIds(ids: readonly string[], { medical }: { medical: boolean }): Promise<Map<string, Member>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return new Map();
  const rows = await prisma.student.findMany({
    where: { id: { in: wanted } },
    select: { ...HIT, contactEmail: true, contactPhone: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true, medicalNotes: true },
  });
  return new Map(rows.map((row) => {
    const hasMedicalNotes = !!row.medicalNotes?.trim();
    return [row.id, {
      ...hitOf(row), contactEmail: row.contactEmail, contactPhone: row.contactPhone,
      emergencyName: row.emergencyName, emergencyPhone: row.emergencyPhone, emergencyRelationship: row.emergencyRelationship,
      hasMedicalNotes, medicalNotes: medical && hasMedicalNotes ? row.medicalNotes : null,
    }];
  }));
}

/** The same checks as adding a swimmer in the swim school, kept short for a booking desk. */
function problemWith(input: NewMember): string | null {
  if (!input.firstName.trim()) return "Give their first name.";
  if (!input.lastName.trim()) return "Give their last name.";
  if (input.firstName.length > 60 || input.lastName.length > 60) return "Keep each name under 60 characters.";
  if (input.dateOfBirth && (!isDateOnly(input.dateOfBirth) || input.dateOfBirth > today())) return "Give a valid date of birth.";
  if (input.memberNumber.length > 40) return "Keep the member number under 40 characters.";
  if (input.contactEmail && !EMAIL.test(input.contactEmail)) return "That email address does not look right.";
  if (input.contactName.length > 120 || input.emergencyName.length > 120) return "Keep each contact name under 120 characters.";
  if (input.contactPhone.length > 40 || input.emergencyPhone.length > 40) return "Keep each phone number under 40 characters.";
  if (input.emergencyRelationship.length > 60) return "Keep the relationship under 60 characters.";
  if (input.medicalNotes.length > 2000) return "Keep the medical notes under 2,000 characters.";
  return null;
}

async function create(raw: NewMember, { siteId, by, via }: { siteId: string; by: { id: string; name: string }; via: string }) {
  const input = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v ?? "").trim()])) as NewMember;
  const problem = problemWith(input);
  if (problem) return { ok: false as const, error: problem };
  if (input.dateOfBirth) {
    const same = await prisma.student.findFirst({
      where: { firstName: { equals: input.firstName, mode: "insensitive" }, lastName: { equals: input.lastName, mode: "insensitive" }, dateOfBirth: parseDateOnly(input.dateOfBirth) },
      select: { memberNumber: true },
    });
    if (same) return { ok: false as const, error: `${input.firstName} ${input.lastName}, born on that day, is already on the swimmer records${same.memberNumber ? ` (member ${same.memberNumber})` : ""}. Find them and pick them instead.` };
  }
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        clubId: siteId, memberNumber: input.memberNumber || null, firstName: input.firstName, lastName: input.lastName,
        dateOfBirth: input.dateOfBirth ? parseDateOnly(input.dateOfBirth) : null,
        contactName: input.contactName || null, contactEmail: input.contactEmail ? input.contactEmail.toLowerCase() : null, contactPhone: input.contactPhone || null,
        emergencyName: input.emergencyName || null, emergencyPhone: input.emergencyPhone || null, emergencyRelationship: input.emergencyRelationship || null,
        medicalNotes: input.medicalNotes || null,
      },
      select: { id: true, firstName: true, lastName: true },
    });
    await logAudit({ actorId: by.id, actorName: by.name, action: "create", entity: "Student", entityId: student.id, clubId: null, summary: `Added ${fullName(student)} (from ${via})` }, tx);
    return { ok: true as const, id: student.id };
  }), `Member number ${input.memberNumber} already belongs to another swimmer.`);
  return result.ok ? result : { ok: false as const, error: result.error };
}

export const memberDirectory: MemberDirectory = { app: "swim-school", search, byIds, create };
