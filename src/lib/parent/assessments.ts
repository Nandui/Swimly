import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { readSharedCurriculum, type SharedCurriculum } from "@/lib/curriculum/data/shared";
import { HOLDS_A_PLACE } from "@/lib/assessments/constants";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { parentAudit, withParent, type ParentIdentity } from "@/lib/parent/auth";
import { childScope, requireChild } from "@/lib/parent/children";
import { ParentApiError, notFound } from "@/lib/parent/errors";
import { dateSchema, idSchema, parseInput, readBody } from "@/lib/parent/http";
import { rateLimit } from "@/lib/parent/security";
import { dublinInstant, PARENT_TIMEZONE } from "@/lib/parent/time";

export const SESSION_SELECT = {
  id: true, date: true, startMinutes: true, durationMinutes: true, location: true, capacity: true,
  cancelledAt: true, programmeId: true, typeId: true, clubId: true,
  club: { select: { id: true, name: true, archivedAt: true } },
  parentPublication: { select: { enabled: true, bookingClosesAt: true } },
  _count: { select: { bookings: { where: { status: { in: HOLDS_A_PLACE } } } } },
} as const satisfies Prisma.AssessmentSessionSelect;
export type PublicSession = Prisma.AssessmentSessionGetPayload<{ select: typeof SESSION_SELECT }>;

export function sessionAvailability(session: PublicSession, curriculum: SharedCurriculum, now: Date) {
  const start = dublinInstant(session.date.toISOString().slice(0, 10), session.startMinutes);
  const closesAt = session.parentPublication?.bookingClosesAt;
  const programme = curriculum.programme(session.programmeId);
  const type = session.typeId ? curriculum.types.find(t => t.id === curriculum.typeIds.resolve(session.typeId!)) : null;
  const open = Boolean(start && start > now && (!closesAt || closesAt > now) && session.parentPublication?.enabled &&
    !session.cancelledAt && !session.club.archivedAt && programme && !programme.archivedAt && (!session.typeId || (type && !type.archivedAt)));
  return { open, start, closesAt: start && closesAt ? new Date(Math.min(start.getTime(), closesAt.getTime())) : start,
    spaces: session.capacity === null ? null : Math.max(0, session.capacity - session._count.bookings) };
}

export function sessionDto(session: PublicSession, curriculum: SharedCurriculum) {
  const programme = curriculum.programme(session.programmeId);
  const type = session.typeId ? curriculum.types.find(t => t.id === curriculum.typeIds.resolve(session.typeId!)) : null;
  const availability = sessionAvailability(session, curriculum, new Date());
  return { id: session.id, site: { id: session.club.id, name: session.club.name }, date: session.date.toISOString().slice(0, 10),
    startMinutes: session.startMinutes, startsAt: availability.start?.toISOString() ?? null, durationMinutes: session.durationMinutes,
    timezone: PARENT_TIMEZONE, location: session.location, programme: programme ? { id: programme.id, name: programme.name } : null,
    type: type ? { id: type.id, name: type.name, description: type.description } : null,
    spacesAvailable: availability.spaces, bookingClosesAt: availability.closesAt?.toISOString() ?? null,
    bookable: availability.open && availability.spaces !== 0, cancelled: Boolean(session.cancelledAt) };
}

export async function listSites() {
  return { items: await prisma.club.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }) };
}

export async function getPublicSession(id: string) {
  const session = await prisma.assessmentSession.findUnique({ where: { id }, select: SESSION_SELECT });
  if (!session) notFound();
  const curriculum = await readSharedCurriculum();
  if (!sessionAvailability(session, curriculum, new Date()).open) notFound();
  return sessionDto(session, curriculum);
}

const sessionQuery = z.object({ siteId: idSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().max(512).optional() }).strict();
const cursorSchema = z.object({ date: dateSchema, start: z.number().int().min(0).max(1439), id: idSchema }).strict();

export async function listSessions(request: Request) {
  const input = parseInput(sessionQuery, Object.fromEntries(new URL(request.url).searchParams));
  const now = new Date(), from = input.from ?? today(now);
  if (!isDateOnly(from)) throw new ParentApiError(400, "INVALID_REQUEST", "Choose a valid start date.");
  const to = input.to ?? new Date(parseDateOnly(from).getTime() + 90 * 86400_000).toISOString().slice(0, 10);
  if (!isDateOnly(from) || !isDateOnly(to) || from < today(now) || to < from || parseDateOnly(to).getTime() - parseDateOnly(from).getTime() > 90 * 86400_000) {
    throw new ParentApiError(400, "INVALID_REQUEST", "Choose dates from today, no more than 90 days apart.");
  }
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (input.cursor) {
    try { cursor = parseInput(cursorSchema, JSON.parse(Buffer.from(input.cursor, "base64url").toString())); }
    catch { throw new ParentApiError(400, "INVALID_CURSOR", "Start a new search."); }
    if (!isDateOnly(cursor.date)) throw new ParentApiError(400, "INVALID_CURSOR", "Start a new search.");
  }
  const rows = await prisma.assessmentSession.findMany({ where: {
    ...(input.siteId ? { clubId: input.siteId } : {}), date: { gte: parseDateOnly(from), lte: parseDateOnly(to) }, cancelledAt: null,
    club: { archivedAt: null }, parentPublication: { is: { enabled: true, OR: [{ bookingClosesAt: null }, { bookingClosesAt: { gt: now } }] } },
    ...(cursor ? { OR: [{ date: { gt: parseDateOnly(cursor.date) } }, { date: parseDateOnly(cursor.date), startMinutes: { gt: cursor.start } },
      { date: parseDateOnly(cursor.date), startMinutes: cursor.start, id: { gt: cursor.id } }] } : {}),
  }, select: SESSION_SELECT, orderBy: [{ date: "asc" }, { startMinutes: "asc" }, { id: "asc" }], take: input.limit + 1 });
  const curriculum = await readSharedCurriculum();
  const page = rows.slice(0, input.limit), last = page.at(-1);
  return { items: page.filter(s => sessionAvailability(s, curriculum, now).open).map(s => sessionDto(s, curriculum)),
    nextCursor: rows.length > input.limit && last ? Buffer.from(JSON.stringify({ date: last.date.toISOString().slice(0, 10), start: last.startMinutes, id: last.id })).toString("base64url") : null };
}

const newChildSchema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), dateOfBirth: dateSchema }).strict();
export const bookingSchema = z.union([
  z.object({ sessionId: idSchema, childId: idSchema }).strict(),
  z.object({ sessionId: idSchema, newChild: newChildSchema }).strict(),
]);
export type ParentBookingInput = z.infer<typeof bookingSchema>;

/** Run under withParent's lock. The assessment lock is also taken by every
 * staff booking/session edit, so both apps compete for the same seats. */
export async function reserveAssessment(tx: Prisma.TransactionClient, parent: ParentAccount, input: ParentBookingInput, key: string) {
  if (!parent.name) throw new ParentApiError(409, "PROFILE_REQUIRED", "Add your name before booking an assessment.");
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const replay = await tx.parentBookingRequest.findUnique({ where: { parentId_key: { parentId: parent.id, key } }, include: { booking: { select: { id: true, studentId: true, sessionId: true, status: true } } } });
  if (replay) {
    if (replay.requestHash !== requestHash) throw new ParentApiError(409, "IDEMPOTENCY_CONFLICT", "That request key was already used for a different booking.");
    await requireChild(tx, parent, replay.booking.studentId);
    return { booking: { id: replay.booking.id, childId: replay.booking.studentId, sessionId: replay.booking.sessionId, status: replay.booking.status }, replayed: true };
  }
  if ("newChild" in input && (!isDateOnly(input.newChild.dateOfBirth) || input.newChild.dateOfBirth > today() || input.newChild.dateOfBirth < "1900-01-01")) {
    throw new ParentApiError(400, "INVALID_REQUEST", "Enter a valid date of birth that is not in the future.");
  }
  await tx.$queryRaw`SELECT id FROM "AssessmentSession" WHERE id=${input.sessionId} FOR UPDATE`;
  const session = await tx.assessmentSession.findUnique({ where: { id: input.sessionId }, select: SESSION_SELECT });
  if (!session) notFound();
  const curriculum = await readSharedCurriculum(tx);
  const available = sessionAvailability(session, curriculum, new Date());
  if (!available.open) throw new ParentApiError(409, "BOOKING_CLOSED", "That assessment is no longer open for booking.");
  if (available.spaces === 0) throw new ParentApiError(409, "SESSION_FULL", "That assessment is full. Please choose another session.");
  let student;
  if ("childId" in input) {
    student = await requireChild(tx, parent, input.childId);
    if (student.status !== "ACTIVE") throw new ParentApiError(409, "CHILD_INACTIVE", "Contact the team to book an assessment for this child.");
  } else {
    // No lookup by name, DOB or contact email: those are not proof of guardianship.
    student = await tx.student.create({ data: { clubId: session.clubId, firstName: input.newChild.firstName, lastName: input.newChild.lastName,
      dateOfBirth: parseDateOnly(input.newChild.dateOfBirth), joinedOn: parseDateOnly(today()), contactName: parent.name,
      contactEmail: parent.email, contactPhone: parent.phone }, select: { id: true, firstName: true, lastName: true } });
    await parentAudit(tx, parent, "create", "Student", student.id, "Registered a new swimmer through an assessment booking", { source: "parent-assessment" });
    const access = await tx.parentChildAccess.create({ data: { parentEmail: parent.email, studentId: student.id, source: "ASSESSMENT_BOOKING" } });
    await parentAudit(tx, parent, "grant", "ParentChildAccess", access.id, "Linked the newly registered child to their parent account", { studentId: student.id });
  }
  const existing = await tx.assessmentBooking.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } }, select: { id: true, status: true } });
  if (existing && HOLDS_A_PLACE.includes(existing.status)) throw new ParentApiError(409, "ALREADY_BOOKED", "This child is already booked on that assessment.");
  const data = { status: "BOOKED" as const, bookedById: null, bookedByName: `${parent.name} (parent)` };
  const booking = existing ? await tx.assessmentBooking.update({ where: { id: existing.id }, data, select: { id: true, status: true } })
    : await tx.assessmentBooking.create({ data: { sessionId: session.id, studentId: student.id, ...data }, select: { id: true, status: true } });
  await tx.parentBookingRequest.create({ data: { parentId: parent.id, key, requestHash, bookingId: booking.id } });
  await parentAudit(tx, parent, "book", "AssessmentBooking", booking.id, "Parent booked an assessment", { studentId: student.id, sessionId: session.id }, session.clubId);
  return { booking: { id: booking.id, childId: student.id, sessionId: session.id, status: booking.status }, replayed: false };
}

export async function bookAssessment(request: Request, identity: ParentIdentity) {
  const key = parseInput(z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/), request.headers.get("idempotency-key"));
  const input = await readBody(request, bookingSchema);
  await rateLimit(`booking:${identity.account.id}`, 30, 3600);
  const result = await withParent(identity, (tx, parent) => reserveAssessment(tx, parent, input, key));
  if (!result.replayed) {
    for (const path of ["/assessments", "/schedule", "/students", "/instructor"]) revalidatePath(path);
    revalidatePath("/assessments/[id]", "page");
    revalidatePath("/students/[id]", "page");
  }
  return result;
}

export async function listBookings(request: Request, tx: Prisma.TransactionClient, parent: ParentAccount) {
  const input = parseInput(z.object({ childId: idSchema.optional(), cursor: idSchema.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict(), Object.fromEntries(new URL(request.url).searchParams));
  if (input.childId) await requireChild(tx, parent, input.childId);
  const rows = await tx.assessmentBooking.findMany({ where: { student: childScope(parent), ...(input.childId ? { studentId: input.childId } : {}),
    ...(input.cursor ? { id: { lt: input.cursor } } : {}) },
    select: { id: true, studentId: true, status: true, createdAt: true, session: { select: SESSION_SELECT } }, orderBy: { id: "desc" }, take: input.limit + 1 });
  const curriculum = await readSharedCurriculum(tx), page = rows.slice(0, input.limit);
  return { items: page.map(row => ({ id: row.id, childId: row.studentId, status: row.status, createdAt: row.createdAt.toISOString(), session: sessionDto(row.session, curriculum) })),
    nextCursor: rows.length > input.limit ? page.at(-1)!.id : null };
}
