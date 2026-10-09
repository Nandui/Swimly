import "server-only";
import { staffDetailOptions, staffDetails } from "@/lib/people/records";
import { hrDatabase } from "@/modules/hr/shared/database";
import { requireHrActor } from "@/modules/hr/shared/access";
import { NOTE_COLUMNS, REVIEW_COLUMNS, type HrNote, type HrReview } from "@/modules/hr/shared/columns";
import { mayFor } from "@/lib/policy/session";
import { personFile } from "@/modules/server";
import { coveredPerson, logHrAccess } from "@/modules/hr/shared/records";

/** Their details as HR keeps them (owner decision, 8 October 2026: staff
 *  details are HR's, not Admin's): position, manager, departments, employment
 *  and contact. Callers have checked `hr.records.read` over the person. */
async function personDetails(userId: string) {
  const row = await staffDetails(userId);
  return {
    ...row,
    startedOn: row.startedOn?.toISOString().slice(0, 10) ?? "",
    dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? "",
    endedOn: row.endedOn?.toISOString().slice(0, 10) ?? "",
  };
}

/** What the details editor chooses from: open sites, departments and positions, and the people who can manage. */
const detailOptions = (orgId: string, positionId: string | null) => staffDetailOptions(orgId, positionId);

/** One person's HR record: their details, visible notes and reviews, what
 *  other modules keep on their personal file (rota, training, absences), and
 *  what the reader may add or change. The one logged read covers all of it. */
export async function hrPerson(userId: string) {
  const who = await requireHrActor();
  const person = await coveredPerson(who, userId);
  const db = hrDatabase();
  const self = userId === who.id;
  // Nobody keeps their own details: they send changes from Turnfin Me.
  const canWriteDetails = !self && await mayFor("hr.details.write", { subjectUserId: userId, orgId: who.orgId });
  const details = await personDetails(userId);
  const [notes, reviews, file, options] = await Promise.all([
    db.query<HrNote>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE org_id=$1 AND subject_user_id=$2 AND withdrawn_at IS NULL
      AND (visibility <> 'private' OR author_id=$3 OR $4) ORDER BY created_at DESC`, [who.orgId, userId, who.id, who.superadmin]),
    db.query<HrReview>(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE org_id=$1 AND subject_user_id=$2
      AND (status <> 'draft' OR reviewer_id=$3 OR $4) ORDER BY created_at DESC`, [who.orgId, userId, who.id, who.superadmin]),
    personFile(userId, who.orgId),
    canWriteDetails ? detailOptions(who.orgId, details.positionId) : null,
  ]);
  await logHrAccess(db, who, [userId], "HrRecord", userId, "HR record");
  return {
    who, person, details, notes, reviews, file, options, canWriteDetails,
    // Nobody writes their own HR record.
    canWriteNotes: !self && await mayFor("hr.notes.write", { subjectUserId: userId, orgId: who.orgId }),
    canWriteReviews: !self && await mayFor("hr.reviews.write", { subjectUserId: userId, orgId: who.orgId }),
  };
}
