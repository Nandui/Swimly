import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hrDatabase, hrConfigured } from "@/modules/hr/lib/database";
import { mySharedHr } from "@/modules/hr/lib/mine";
import { acknowledgeReviewFor } from "@/modules/hr/lib/self";
import { myQualifications } from "@/lib/people/mine";
import { myDays } from "@/modules/rota/lib/mine";
import { docsReading } from "@/modules/docs";
import { completeTrainingFor, myTraining } from "@/modules/training";
import { StaffApiError, notFound } from "@/lib/staff-api/errors";
import { idSchema, parseInput, readBody } from "@/lib/staff-api/http";
import { rateLimit } from "@/lib/staff-api/security";
import { requireConfirmed, type StaffIdentity } from "@/lib/staff-api/auth";

/** Everything Turnfin Me can read or do, for the signed-in person only. Every
 *  response is built field by field from an allowlist: no swimmers, refunds,
 *  other staff, permissions or internal notes ever leave through here. */

const date = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);
const failed = (message: string) => new StaffApiError(409, "NOT_POSSIBLE", message);

// ---------------------------------------------------------------------------
// Me and my details
// ---------------------------------------------------------------------------

export const DETAIL_FIELDS = ["phone", "homeAddress", "emergencyName", "emergencyPhone", "emergencyRelationship"] as const;
type DetailField = (typeof DETAIL_FIELDS)[number];

export async function profile(identity: StaffIdentity) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: identity.user.id }, select: {
    name: true, email: true, jobTitle: true, primaryClubId: true,
    phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
  } });
  const [site, pending] = await Promise.all([
    user.primaryClubId ? prisma.club.findUnique({ where: { id: user.primaryClubId }, select: { name: true } }) : null,
    prisma.staffDetailChangeRequest.findFirst({ where: { userId: identity.user.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { proposed: true, createdAt: true } }),
  ]);
  const latest = await prisma.staffDetailChangeRequest.findFirst({
    where: { userId: identity.user.id, status: { in: ["APPLIED", "DECLINED"] } }, orderBy: { reviewedAt: "desc" }, select: { status: true, reply: true, reviewedAt: true },
  });
  return {
    name: user.name, email: user.email, jobTitle: user.jobTitle ?? "", site: site?.name ?? null,
    details: Object.fromEntries(DETAIL_FIELDS.map((f) => [f, user[f] ?? ""])),
    pendingChange: pending ? { proposed: pending.proposed, sentAt: pending.createdAt.toISOString() } : null,
    lastDecision: latest ? { status: latest.status, reply: latest.reply, decidedAt: latest.reviewedAt?.toISOString() ?? null } : null,
  };
}

const text = (max: number) => z.string().trim().max(max);
const detailsSchema = z.object({
  phone: text(40).optional(),
  homeAddress: text(300).optional(),
  emergencyName: text(120).optional(),
  emergencyPhone: text(40).optional(),
  emergencyRelationship: text(60).optional(),
  message: text(500).default(""),
}).strict().refine((v) => DETAIL_FIELDS.some((f) => v[f] !== undefined), "Include at least one detail to change.");

export async function requestDetailsChange(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, detailsSchema);
  await rateLimit(`details:${identity.user.id}`, 10, 3600);
  if (await prisma.staffDetailChangeRequest.count({ where: { userId: identity.user.id, status: "PENDING" } })) {
    throw failed("You already have changes waiting for review. You can send more once they are done.");
  }
  const { message, ...fields } = input;
  const proposed = Object.fromEntries(DETAIL_FIELDS.filter((f) => fields[f] !== undefined).map((f) => [f, fields[f] as string]));
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.staffDetailChangeRequest.create({ data: { orgId: identity.user.orgId, userId: identity.user.id, proposed, message } });
    // Names the fields, never the values.
    await logAudit({ actorId: identity.user.id, actorName: identity.user.name, action: "request-details-change", entity: "User", entityId: identity.user.id,
      summary: `Asked to change their ${Object.keys(proposed).join(", ")} (Turnfin Me)`, details: { requestId: created.id } }, tx);
    return created;
  });
  return { id: row.id, status: row.status, sentAt: row.createdAt.toISOString() };
}

// ---------------------------------------------------------------------------
// Qualifications and certificate uploads
// ---------------------------------------------------------------------------

export async function qualifications(identity: StaffIdentity) {
  const [held, uploads, types] = await Promise.all([
    myQualifications(identity.user.id),
    prisma.qualificationEvidence.findMany({ where: { userId: identity.user.id }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, typeId: true, typeName: true, status: true, reviewNote: true, createdAt: true, fileName: true } }),
    prisma.qualificationType.findMany({ where: { orgId: identity.user.orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  return {
    items: held.map((q) => ({ id: q.id, name: q.type.name, issuedOn: date(q.issuedOn), expiresOn: date(q.expiresOn), state: q.state, reference: q.reference })),
    uploads: uploads.map((u) => ({ id: u.id, name: u.typeId ? typeName.get(u.typeId) ?? u.typeName : u.typeName, status: u.status, note: u.reviewNote, sentAt: u.createdAt.toISOString(), fileName: u.fileName })),
    types,
  };
}

const MIME = { "application/pdf": [0x25, 0x50, 0x44, 0x46], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/jpeg": [0xff, 0xd8, 0xff] } as const;
const uploadSchema = z.object({
  typeId: z.string().max(64).optional(),
  typeName: text(120).optional(),
  issuedOn: z.string().refine(isDateOnly, "Use a date.").optional(),
  /** The one date a certificate must give (owner decision, 9 October 2026). */
  expiresOn: z.string().refine(isDateOnly, "Give the expiry date on the certificate."),
  reference: text(80).default(""),
  fileName: z.string().trim().min(1).max(120).regex(/^[^/\\\r\n]+$/, "Use a plain file name."),
  mime: z.enum(Object.keys(MIME) as [keyof typeof MIME]),
  data: z.string().min(4).max(7_200_000),
}).strict().refine((v) => v.typeId || v.typeName, "Say which qualification it is.");

export async function uploadEvidence(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, uploadSchema, 7_400_000);
  await rateLimit(`upload:${identity.user.id}`, 20, 86400);
  const bytes = Buffer.from(input.data, "base64");
  if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new StaffApiError(413, "BODY_TOO_LARGE", "Files can be up to 5 MB.");
  if (!MIME[input.mime].every((b, i) => bytes[i] === b)) throw new StaffApiError(400, "INVALID_REQUEST", "That file does not look like a PDF, PNG or JPEG.");
  if (input.issuedOn && input.expiresOn && input.expiresOn < input.issuedOn) throw new StaffApiError(400, "INVALID_REQUEST", "The expiry date is before the issue date.");
  const type = input.typeId ? await prisma.qualificationType.findFirst({ where: { id: input.typeId, orgId: identity.user.orgId, archivedAt: null }, select: { id: true, name: true } }) : null;
  if (input.typeId && !type) notFound();
  if (await prisma.qualificationEvidence.count({ where: { userId: identity.user.id, status: "PENDING" } }) >= 10) {
    throw failed("You have ten certificates waiting to be checked. Send more once those are done.");
  }
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.qualificationEvidence.create({ data: {
      orgId: identity.user.orgId, userId: identity.user.id, typeId: type?.id ?? null, typeName: type?.name ?? input.typeName ?? "",
      issuedOn: input.issuedOn ? parseDateOnly(input.issuedOn) : null, expiresOn: parseDateOnly(input.expiresOn),
      reference: input.reference, fileName: input.fileName, mime: input.mime, size: bytes.length, bytes,
    } });
    await logAudit({ actorId: identity.user.id, actorName: identity.user.name, action: "upload-certificate", entity: "Qualification", entityId: created.id,
      summary: `Sent a ${type?.name ?? input.typeName} certificate to be checked (Turnfin Me)` }, tx);
    return created;
  });
  return { id: row.id, status: row.status };
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

type TrainingRow = Awaited<ReturnType<typeof myTraining>>[number];
const trainingDto = (row: TrainingRow) => ({
  id: row.id, title: row.course.title, summary: row.course.summary, state: row.state, requiresSignoff: row.course.requiresSignoff,
  grants: row.course.grantsType?.name ?? null, dueOn: date(row.dueOn), assignedBy: row.assignedByName, assignedAt: row.assignedAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null, signedOffBy: row.signedOffByName, trainerNote: row.signoffNote,
});

export async function training(identity: StaffIdentity) {
  return { items: (await myTraining(identity.user.id)).map(trainingDto) };
}

export async function trainingItem(identity: StaffIdentity, id: string) {
  const row = (await myTraining(identity.user.id)).find((r) => r.id === id);
  if (!row) notFound();
  return { ...trainingDto(row), content: row.course.content };
}

export async function completeTraining(request: Request, identity: StaffIdentity, id: string) {
  const { note } = await readBody(request, z.object({ note: text(1000).default("") }).strict());
  const result = await completeTrainingFor({ id: identity.user.id, name: identity.user.name }, id, note);
  if (!result.ok) {
    if (result.error.includes("not assigned to you")) notFound();
    throw failed(result.error);
  }
  return trainingItem(identity, id);
}

// ---------------------------------------------------------------------------
// Required reading (Docs database)
// ---------------------------------------------------------------------------

async function myRequirements(identity: StaffIdentity) {
  const d = await docsReading();
  if (!d) return [];
  try {
    return (await d.requirements(identity.user.id)).filter((r) => r.status !== "cancelled");
  } catch {
    // Someone without Docs access has no required reading.
    return [];
  }
}

export async function reading(identity: StaffIdentity) {
  const on = today();
  return { items: (await myRequirements(identity)).map((r) => ({
    documentId: r.documentId, versionId: r.versionId, title: r.title, reference: r.reference, version: r.version,
    dueOn: r.dueDate ? r.dueDate.slice(0, 10) : null, status: r.status, acknowledgedAt: r.acknowledgedAt,
    overdue: r.status === "outstanding" && !!r.dueDate && r.dueDate.slice(0, 10) < on,
  })) };
}

/** Only documents assigned to the person as required reading open here. */
export async function readingItem(identity: StaffIdentity, documentId: string) {
  const requirement = (await myRequirements(identity)).find((r) => r.documentId === documentId);
  const d = await docsReading();
  if (!requirement || !d) notFound();
  const view = await d.documentView(identity.user.id, documentId, requirement.versionId);
  const content = view.selected?.content;
  if (!content) notFound();
  return {
    documentId, versionId: requirement.versionId, version: requirement.version, title: content.title, reference: content.reference,
    summary: content.summary, body: content.body, dueOn: requirement.dueDate ? requirement.dueDate.slice(0, 10) : null,
    status: requirement.status, acknowledgedAt: view.acknowledgedAt,
    current: view.document.currentVersionId === requirement.versionId,
  };
}

export async function acknowledgeReading(request: Request, identity: StaffIdentity, documentId: string) {
  const { versionId } = await readBody(request, z.object({ versionId: idSchema }).strict());
  const requirement = (await myRequirements(identity)).find((r) => r.documentId === documentId && r.versionId === versionId);
  const d = await docsReading();
  if (!requirement || !d) notFound();
  try {
    await d.acknowledge(identity.user.id, documentId, versionId);
  } catch (error) {
    throw failed(error instanceof Error ? error.message : "That could not be recorded. Try again.");
  }
  return readingItem(identity, documentId);
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function shifts(request: Request, identity: StaffIdentity) {
  const days = parseInput(z.coerce.number().int().min(1).max(56), new URL(request.url).searchParams.get("days") ?? 28);
  // Each day at each site: the activities, the breaks placed for them, and the shift from them.
  return { items: (await myDays(identity.user.id, days)).map((d) => ({
    id: `${d.date}|${d.siteId}`, date: d.date, site: d.site, changed: d.changed,
    startMinutes: d.shift.start, endMinutes: d.shift.end, paidMinutes: d.shift.paidMinutes,
    // Breaks they are owed that found no free time: to arrange with the duty manager on the day.
    breaksToArrange: d.shift.parts.reduce((n, p) => n + p.unplaced.reduce((m, b) => m + b.minutes, 0), 0),
    blocks: [
      ...d.items.map((i) => ({ kind: "activity" as const, startMinutes: i.start, endMinutes: i.end, label: i.label, icon: i.icon, place: i.place, needs: i.needs, warning: i.problem })),
      ...d.shift.parts.flatMap((p) => p.breaks.map((b) => ({ kind: "break" as const, startMinutes: b.start, endMinutes: b.end, label: b.paid ? "Paid break" : "Unpaid break", icon: "break", place: "", needs: null, warning: null }))),
    ].sort((a, b) => a.startMinutes - b.startMinutes),
  })) };
}

// ---------------------------------------------------------------------------
// HR: what has been shared with the person (needs a fresh code)
// ---------------------------------------------------------------------------

export async function hr(identity: StaffIdentity) {
  requireConfirmed(identity);
  if (!hrConfigured()) return { configured: false, notes: [], reviews: [] };
  const { notes, reviews } = await mySharedHr(identity.user.id, identity.user.orgId);
  // The person reading their own record is logged like every HR read.
  await hrDatabase().query(
    `INSERT INTO access_events (org_id, actor_id, actor_name, subject_user_ids, entity, entity_id, purpose) VALUES ($1,$2,$3,$4,'HrRecord',$2,'own HR record (Turnfin Me)')`,
    [identity.user.orgId, identity.user.id, identity.user.name, [identity.user.id]],
  );
  return {
    configured: true,
    notes: notes.map((n) => ({ id: n.id, author: n.authorName, body: n.body, createdAt: new Date(n.createdAt).toISOString() })),
    reviews: reviews.map((r) => ({
      id: r.id, period: r.period, reviewer: r.reviewerName, status: r.status, summary: r.summary, strengths: r.strengths, goals: r.goals,
      overall: r.overall, comment: r.subjectComment, sharedAt: r.sharedAt ? new Date(r.sharedAt).toISOString() : null,
      acknowledgedAt: r.acknowledgedAt ? new Date(r.acknowledgedAt).toISOString() : null,
    })),
  };
}

export async function acknowledgeReview(request: Request, identity: StaffIdentity, id: string) {
  requireConfirmed(identity);
  const { comment } = await readBody(request, z.object({ comment: text(2000).default("") }).strict());
  if (!hrConfigured()) notFound();
  const result = await acknowledgeReviewFor({ id: identity.user.id, name: identity.user.name, orgId: identity.user.orgId }, id, comment);
  if (!result.ok) notFound();
  return hr(identity);
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

const PREFS = ["trainingDue", "qualificationExpiry", "readingOverdue", "shiftChanges"] as const;

export async function notifications(identity: StaffIdentity) {
  const row = await prisma.staffNotificationPreference.findUnique({ where: { userId: identity.user.id } });
  return Object.fromEntries(PREFS.map((key) => [key, row ? row[key] : true]));
}

export async function saveNotifications(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, z.object(Object.fromEntries(PREFS.map((k) => [k, z.boolean()])) as Record<(typeof PREFS)[number], z.ZodBoolean>).strict());
  await prisma.staffNotificationPreference.upsert({ where: { userId: identity.user.id }, update: input, create: { userId: identity.user.id, ...input } });
  return notifications(identity);
}

// ---------------------------------------------------------------------------
// Home: what needs the person, without any HR content
// ---------------------------------------------------------------------------

export async function home(identity: StaffIdentity) {
  const [train, read, quals, upcoming, reviewsWaiting] = await Promise.all([
    training(identity),
    reading(identity),
    myQualifications(identity.user.id),
    myDays(identity.user.id, 7),
    hrConfigured()
      ? mySharedHr(identity.user.id, identity.user.orgId).then((r) => r.reviews.filter((x) => x.status === "shared").length).catch(() => 0)
      : Promise.resolve(0),
  ]);
  return {
    name: identity.user.name,
    training: train.items.filter((t) => t.state === "assigned" || t.state === "overdue" || t.state === "submitted"),
    reading: read.items.filter((r) => r.status === "outstanding"),
    qualifications: quals.filter((q) => q.state === "expiring" || q.state === "expired").map((q) => ({ id: q.id, name: q.type.name, expiresOn: date(q.expiresOn), state: q.state })),
    // Each day's shift, worked out from the activities on it.
    shifts: upcoming.slice(0, 3).map((d) => ({ id: `${d.date}|${d.siteId}`, date: d.date, startMinutes: d.shift.start, endMinutes: d.shift.end,
      role: [...new Set(d.items.map((i) => i.label.split(":")[0]))].join(", "), site: d.site, warnings: [...new Set(d.items.flatMap((i) => (i.problem ? [i.problem] : [])))] })),
    // A count only: HR content needs a fresh code.
    reviewsToAcknowledge: reviewsWaiting,
  };
}

export type DetailChange = Partial<Record<DetailField, string>>;
