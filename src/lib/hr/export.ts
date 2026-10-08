import "server-only";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { hrDatabase } from "@/lib/hr/database";
import { NOTE_COLUMNS, REVIEW_COLUMNS, type HrNote, type HrReview } from "@/lib/hr/columns";
import { logHrAccess } from "@/lib/hr/records";
import { recentlyConfirmed } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";
import { personFile } from "@/modules/server";

export class ExportRefused extends Error {}

/** Everything Turnfin holds about one staff member's employment, for a subject
 *  access request: their profile, training, qualifications, their personal
 *  file from other modules (absences and returns to work) and the whole HR
 *  record (private notes and drafts included, withdrawn notes marked). Only a
 *  superadmin with a recent password can take it, and the export is logged. */
export async function subjectExport(userId: string) {
  const actor = actorForSession(await requireSession());
  if (!actor.superadmin) throw new ExportRefused("Only a superadmin can export a person's records.");
  if (!recentlyConfirmed(actor)) throw new ExportRefused("Confirm your password first.");
  const person = await prisma.user.findFirst({
    where: { id: userId, orgId: actor.orgId ?? undefined },
    select: {
      id: true, name: true, email: true, jobTitle: true, startedOn: true, isActive: true, createdAt: true,
      dateOfBirth: true, contractType: true, contractMinutes: true, endedOn: true, payrollNumber: true,
      phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
    },
  });
  if (!person) return null;
  const [qualifications, training] = await Promise.all([
    prisma.qualification.findMany({ where: { userId }, select: { issuedOn: true, expiresOn: true, revokedAt: true, reference: true, note: true, type: { select: { name: true } } } }),
    prisma.trainingAssignment.findMany({ where: { userId }, select: { status: true, dueOn: true, assignedAt: true, assignedByName: true, completedAt: true, signedOffByName: true, signoffNote: true, learnerNote: true, cancelReason: true, course: { select: { title: true } } } }),
  ]);
  const db = hrDatabase();
  const orgId = actor.orgId ?? "";
  const [notes, reviews, reads, file] = await Promise.all([
    db.query<HrNote & { withdrawnAt: Date | null; withdrawnReason: string }>(`SELECT ${NOTE_COLUMNS}, withdrawn_at AS "withdrawnAt", withdrawn_reason AS "withdrawnReason" FROM notes WHERE org_id=$1 AND subject_user_id=$2 ORDER BY created_at`, [orgId, userId]),
    db.query<HrReview>(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE org_id=$1 AND subject_user_id=$2 ORDER BY created_at`, [orgId, userId]),
    db.query<{ actorName: string; purpose: string; at: Date }>(`SELECT actor_name AS "actorName", purpose, at FROM access_events WHERE org_id=$1 AND $2 = ANY(subject_user_ids) ORDER BY at`, [orgId, userId]),
    personFile(userId, orgId),
  ]);
  await logHrAccess(db, { id: actor.id, name: actor.name, orgId }, [userId], "HrExport", userId, "subject export");
  return {
    exportedAt: new Date().toISOString(),
    exportedBy: actor.name,
    person,
    qualifications,
    training,
    personalFile: file,
    hr: { notes, reviews, whoReadThisRecord: reads },
  };
}
