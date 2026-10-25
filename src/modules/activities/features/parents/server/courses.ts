import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { AppCourseError, appCourses, type AppCourse, type AppCourses } from "@/modules/contributions";
import { isAdult, parentAudit, profileMissing, withParent, type ParentIdentity } from "@/modules/activities/shared/parents/auth";
import { childScope, requireChild } from "@/modules/activities/shared/parents/children";
import { ParentApiError, notFound } from "@/modules/activities/shared/parents/errors";
import { dateSchema, idSchema, readBody } from "@/modules/activities/shared/parents/http";
import { rateLimit } from "@/modules/activities/shared/parents/security";

/** Swimming courses in the parents app (owner decisions, 21 October 2026).
 *  Short courses owns the courses and registers them (`registerAppCourses`); this API lists them
 *  and holds places through that seam, never reading short-course tables.
 *
 *  - A minimum age of 18 or more is an adult course, booked by an adult account for themselves.
 *    The rest are booked by family accounts for a linked child whose age fits.
 *  - An adult's first booking makes their own swimmer record (as an assessment booking does for a
 *    new child: never matched to an existing swimmer by name or birthday; staff merge duplicates).
 *  - Holding a place is not paying: the desk phones within 72 hours. A full course is just full. */

/** The age from which a course is for adults. */
export const ADULT_AGE = 18;
export const forAdults = (course: Pick<AppCourse, "minAge">) => course.minAge !== null && course.minAge >= ADULT_AGE;

async function source(): Promise<AppCourses> {
  const found = await appCourses();
  if (!found) throw new ParentApiError(503, "UNAVAILABLE", "Courses are not available right now. Try again later.");
  return found;
}

const courseDto = (c: AppCourse) => ({ ...c, forAdults: forAdults(c), full: c.placesLeft === 0 });

/** Every swimming course open in the app, soonest first; full ones too. No sign-in needed. */
export async function listCourses() {
  return { items: (await (await source()).list()).map(courseDto) };
}

export async function getCourse(id: string) {
  const course = await (await source()).one(id);
  if (!course) notFound();
  return courseDto(course);
}

const SELF_SELECT = { id: true, firstName: true, lastName: true, dateOfBirth: true, memberNumber: true } as const satisfies Prisma.StudentSelect;

/** An adult account's own swimmer details, once their first booking has made them. */
export async function adultSwimmer(tx: Prisma.TransactionClient, account: Pick<ParentAccount, "kind" | "swimmerId">) {
  if (!isAdult(account) || !account.swimmerId) return null;
  const me = await tx.student.findUnique({ where: { id: account.swimmerId }, select: SELF_SELECT });
  return me ? { firstName: me.firstName, lastName: me.lastName, dateOfBirth: me.dateOfBirth?.toISOString().slice(0, 10) ?? null, memberNumber: me.memberNumber } : null;
}

const holdSchema = z.object({
  courseId: idSchema,
  /** A family account: which linked child. */
  childId: idSchema.optional(),
  /** An adult account's first booking: who they are, for their swimmer record. */
  me: z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), dateOfBirth: dateSchema }).strict().optional(),
  callTimes: z.array(z.enum(["morning", "afternoon", "evening"])).max(3).default([]),
  note: z.string().trim().max(500).default(""),
}).strict();

/** Hold a place for the adult themselves or a linked child, and make the adult's swimmer record on
 *  their first booking, in one transaction. */
export async function holdCoursePlace(request: Request, identity: ParentIdentity) {
  const input = await readBody(request, holdSchema);
  await rateLimit(`course-hold:${identity.account.id}`, 10, 3600);
  const courses = await source();
  const course = await courses.one(input.courseId);
  if (!course) throw new ParentApiError(404, "NOT_FOUND", "That course is no longer open for booking.");
  const held = await withParent(identity, async (tx, parent) => {
    if (profileMissing(parent)) throw new ParentApiError(409, "PROFILE_REQUIRED", "Add your name and phone number before booking a course.");
    let swimmer: { id: string; name: string; dateOfBirth: string | null };
    if (isAdult(parent)) {
      if (input.childId) throw new ParentApiError(403, "FAMILY_ACCOUNT_ONLY", "Children's courses are booked from a family account.");
      if (!forAdults(course)) throw new ParentApiError(409, "NOT_FOR_ADULTS", "This course is for children. Book it from a family account.");
      swimmer = await ensureSelf(tx, parent, course.site.id, input.me);
    } else {
      if (!input.childId) throw new ParentApiError(400, "INVALID_REQUEST", "Choose which child the place is for.");
      if (forAdults(course)) throw new ParentApiError(409, "ADULTS_ONLY", "This course is for adults. They book it with their own adult account.");
      const child = await requireChild(tx, parent, input.childId);
      if (child.status !== "ACTIVE") throw new ParentApiError(409, "CHILD_INACTIVE", "Contact the team to book a course for this child.");
      swimmer = { id: child.id, name: `${child.firstName} ${child.lastName}`, dateOfBirth: child.dateOfBirth?.toISOString().slice(0, 10) ?? null };
    }
    try {
      return await courses.hold(tx, { courseId: course.id, swimmerId: swimmer.id, name: swimmer.name, dateOfBirth: swimmer.dateOfBirth,
        email: parent.email, phone: parent.phone ?? "", callTimes: input.callTimes, note: input.note, by: `${parent.name} (parents app)` });
    } catch (error) {
      if (error instanceof AppCourseError) throw new ParentApiError(error.status, error.code, error.message);
      throw error;
    }
  });
  for (const path of ["/short-courses", "/students"]) revalidatePath(path);
  revalidatePath("/short-courses/[id]", "page");
  return { hold: held };
}

/** The adult's swimmer record: theirs already, or made now from what they gave. */
async function ensureSelf(tx: Prisma.TransactionClient, parent: ParentAccount, siteId: string, me: z.infer<typeof holdSchema>["me"]) {
  if (parent.swimmerId) {
    const found = await tx.student.findUnique({ where: { id: parent.swimmerId }, select: SELF_SELECT });
    if (found) return { id: found.id, name: `${found.firstName} ${found.lastName}`, dateOfBirth: found.dateOfBirth?.toISOString().slice(0, 10) ?? null };
  }
  if (!me) throw new ParentApiError(409, "DETAILS_REQUIRED", "Add your first name, last name and date of birth to book your first course.");
  if (!isDateOnly(me.dateOfBirth) || me.dateOfBirth > today() || me.dateOfBirth < "1900-01-01") {
    throw new ParentApiError(400, "INVALID_REQUEST", "Enter a valid date of birth that is not in the future.");
  }
  // No lookup by name or birthday: those are not proof of who someone is. Staff merge duplicates.
  const created = await tx.student.create({ data: { clubId: siteId, firstName: me.firstName, lastName: me.lastName, dateOfBirth: parseDateOnly(me.dateOfBirth),
    joinedOn: parseDateOnly(today()), contactName: parent.name, contactEmail: parent.email, contactPhone: parent.phone }, select: { id: true } });
  await tx.parentAccount.update({ where: { id: parent.id }, data: { swimmerId: created.id } });
  await parentAudit(tx, parent, "create", "Student", created.id, "Registered as a swimmer through a course booking in the parents app", { source: "parent-course" }, siteId);
  return { id: created.id, name: `${me.firstName} ${me.lastName}`, dateOfBirth: me.dateOfBirth };
}

/** Places on swimming courses: an adult's own, or each linked child's, however they were booked.
 *  Whose they are is checked under the parent's lock; the places are read after it. */
export async function listCourseBookings(identity: ParentIdentity) {
  const people = await withParent(identity, async (tx, parent) => isAdult(parent)
    ? parent.swimmerId ? tx.student.findMany({ where: { id: parent.swimmerId }, select: { id: true, firstName: true } }) : []
    : tx.student.findMany({ where: childScope(parent), select: { id: true, firstName: true } }));
  const names = new Map(people.map((p) => [p.id, p.firstName]));
  const bookings = await (await source()).bookingsFor(people.map((p) => p.id));
  return { items: bookings.map((b) => ({ ...b, person: names.get(b.swimmerId) ?? "" })) };
}
