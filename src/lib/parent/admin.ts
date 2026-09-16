import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, canSee, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { lockParent } from "@/lib/parent/security";
import { ParentApiError, notFound } from "@/lib/parent/errors";
import { emailSchema, errorResponse, idSchema, json, parseInput, readBody, reasonSchema } from "@/lib/parent/http";
import { dublinInstant } from "@/lib/parent/time";
import { SESSION_SELECT, sessionAvailability, type PublicSession } from "@/lib/parent/assessments";
import { readSharedCurriculum, type SharedCurriculum } from "@/lib/curriculum/data/shared";
import { listAccessReviews, reviewAccessRequest } from "@/lib/parent/access-review";

function publicationDto(session: PublicSession, curriculum: SharedCurriculum) {
  const now = new Date();
  const availability = sessionAvailability(session, curriculum, now);
  const eligibility = sessionAvailability({ ...session, parentPublication: { enabled: true, bookingClosesAt: null } }, curriculum, now);
  return { sessionId: session.id, enabled: session.parentPublication?.enabled ?? false,
    bookingClosesAt: session.parentPublication?.bookingClosesAt ?? null,
    canPublish: eligibility.open, visibleToParents: availability.open, spacesAvailable: availability.spaces };
}

/** This surface accepts existing staff cookies only. Parent bearer tokens,
 * cross-origin requests and Instructor-only screen grants cannot authorize it. */
export async function handleParentAdminRequest(request: Request, path: string[]) {
  let response: Response;
  try {
    response = await dispatch(request, path);
    if (request.method !== "GET" && response.ok) {
      revalidatePath("/activity");
      if (path[0] === "assessment-sessions") { revalidatePath("/assessments", "layout"); revalidatePath(`/assessments/${path[1]}`); }
      else { revalidatePath("/students/parents"); if (path[0] === "children") revalidatePath(`/students/${path[1]}`); }
    }
  }
  catch (error) {
    response = errorResponse(error instanceof AuthorizationError
      ? new ParentApiError(403, "FORBIDDEN", "Staff permission is required.") : error);
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin, Cookie");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

async function dispatch(request: Request, path: string[]) {
  const origin = request.headers.get("origin"), safe = request.method === "GET";
  if (request.headers.has("authorization") || (origin && origin !== new URL(request.url).origin) || (!safe && !origin)) {
    throw new ParentApiError(403, "FORBIDDEN", "Use the staff app to manage parent access.");
  }
  const route = path.join("/"), method = request.method;
  const accessRoute = /^children\/([^/]+)\/access$/.exec(route);
  const publicationRoute = /^assessment-sessions\/([^/]+)\/publication$/.exec(route);
  const accountRoute = /^accounts\/([^/]+)$/.exec(route);
  const reviewRoute = /^access-requests\/([^/]+)$/.exec(route);
  const methods = accessRoute ? ["GET", "PUT", "DELETE"] : publicationRoute ? ["GET", "PUT"] : accountRoute || reviewRoute ? ["PATCH"] : route === "accounts" || route === "access-requests" ? ["GET"] : null;
  if (!methods) notFound();
  if (!methods.includes(method)) throw new ParentApiError(405, "METHOD_NOT_ALLOWED", "This endpoint does not accept that method.", { Allow: methods.join(", ") });
  const actor = await requirePermission(publicationRoute ? "courses.manage" : "parents.manage");
  if (!canSee(actor, publicationRoute ? "assessments" : "students")) throw new ParentApiError(403, "FORBIDDEN", "This staff workspace cannot manage those records.");
  const attribution = { actorId: actor.user.id, actorName: actor.user.name ?? "Staff", clubId: null };
  if (route === "access-requests") return json(await listAccessReviews(request));
  if (reviewRoute) return json(await reviewAccessRequest(request, reviewRoute[1], attribution));
  if (accessRoute) {
    const studentId = parseInput(idSchema, accessRoute[1]);
    if (!await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } })) notFound();
    if (safe) return json({ items: await prisma.parentChildAccess.findMany({ where: { studentId },
      select: { id: true, parentEmail: true, source: true, revokedAt: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "asc" } }) });
    const { email, reason } = await readBody(request, z.object({ email: emailSchema, reason: reasonSchema }).strict());
    const access = await prisma.$transaction(async tx => {
      await lockParent(tx, email);
      const previous = await tx.parentChildAccess.findUnique({ where: { parentEmail_studentId: { parentEmail: email, studentId } } });
      if (method === "DELETE" && !previous) notFound();
      const row = method === "DELETE"
        ? await tx.parentChildAccess.update({ where: { id: previous!.id }, data: { revokedAt: new Date() } })
        : await tx.parentChildAccess.upsert({ where: { parentEmail_studentId: { parentEmail: email, studentId } },
          create: { parentEmail: email, studentId, source: "STAFF", grantedById: actor.user.id },
          update: { revokedAt: null, source: "STAFF", grantedById: actor.user.id } });
      await logAudit({ ...attribution, action: method === "DELETE" ? "revoke" : "grant", entity: "ParentChildAccess", entityId: row.id,
        summary: `${method === "DELETE" ? "Revoked" : "Approved"} parent access for ${email}: ${reason}`, details: { studentId, email, reason } }, tx);
      return { id: row.id, parentEmail: row.parentEmail, studentId: row.studentId, revokedAt: row.revokedAt };
    });
    return json(access);
  }
  if (publicationRoute) {
    const sessionId = parseInput(idSchema, publicationRoute[1]), clubId = await currentClubId();
    const data = safe ? null : await readBody(request, z.object({ enabled: z.boolean(), bookingClosesAt: z.iso.datetime({ offset: true }).nullable().optional(), reason: reasonSchema }).strict());
    return json(await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "AssessmentSession" WHERE id=${sessionId} FOR UPDATE`;
      const session = await tx.assessmentSession.findUnique({ where: { id: sessionId, clubId }, select: SESSION_SELECT });
      if (!session) notFound();
      const curriculum = await readSharedCurriculum(tx);
      const current = publicationDto(session, curriculum);
      if (!data) return current;
      const start = dublinInstant(session.date.toISOString().slice(0, 10), session.startMinutes);
      const closesAt = data.bookingClosesAt === undefined ? session.parentPublication?.bookingClosesAt ?? null : data.bookingClosesAt ? new Date(data.bookingClosesAt) : null;
      if (data.enabled && (!start || start <= new Date() || session.cancelledAt || (closesAt && (closesAt > start || closesAt <= new Date())))) {
        throw new ParentApiError(400, "INVALID_REQUEST", "Publish a future assessment with a booking deadline no later than its start time.");
      }
      if (data.enabled && !current.canPublish) throw new ParentApiError(400, "INVALID_REQUEST", "Choose an active site, programme and assessment type before publishing.");
      const publication = await tx.parentAssessmentPublication.upsert({ where: { sessionId }, create: { sessionId, enabled: data.enabled, bookingClosesAt: closesAt }, update: { enabled: data.enabled, bookingClosesAt: closesAt } });
      await logAudit({ ...attribution, clubId, action: data.enabled ? "publish" : "unpublish", entity: "ParentAssessmentPublication", entityId: sessionId,
        summary: `${data.enabled ? "Opened" : "Closed"} parent assessment booking: ${data.reason}`, details: { enabled: data.enabled, bookingClosesAt: closesAt?.toISOString() ?? null, reason: data.reason } }, tx);
      return publicationDto({ ...session, parentPublication: publication }, curriculum);
    }));
  }
  if (accountRoute) {
    const id = parseInput(idSchema, accountRoute[1]);
    const data = await readBody(request, z.object({ isActive: z.boolean(), reason: reasonSchema }).strict());
    const source = await prisma.parentAccount.findUnique({ where: { id }, select: { email: true } });
    if (!source) notFound();
    return json(await prisma.$transaction(async tx => {
      await lockParent(tx, source.email);
      const parent = await tx.parentAccount.update({ where: { id }, data: { isActive: data.isActive }, select: { id: true, email: true, isActive: true } });
      if (!data.isActive) await tx.parentSession.updateMany({ where: { parentId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await logAudit({ ...attribution, action: data.isActive ? "activate" : "suspend", entity: "ParentAccount", entityId: id,
        summary: `${data.isActive ? "Reactivated" : "Suspended"} parent account${data.isActive ? "" : " and revoked its sessions"}: ${data.reason}`, details: { reason: data.reason } }, tx);
      return parent;
    }));
  }
  const query = parseInput(z.object({ email: emailSchema }).strict(), Object.fromEntries(new URL(request.url).searchParams));
  const account = await prisma.parentAccount.findUnique({ where: { email: query.email }, select: { id: true, email: true, name: true, phone: true, isActive: true, createdAt: true } });
  return json({ account });
}
