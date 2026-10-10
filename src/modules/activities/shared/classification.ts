import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { isActivitiesScreen, visibleScreens } from "@/lib/staff/screens";

/** Aquatics data classification: which sensitive swimmer fields are which
 *  class, and which surface may see each class. Every loader that returns
 *  swimmer data goes through here, so the rules live in one place.
 *
 *  Owner rules (September 2026):
 *  - Medical notes: reception and swim school management (desk and office
 *    capabilities), and instructors only for the class they are teaching or
 *    covering (the deck, which already requires a started class). No other
 *    role receives them.
 *  - Contact and emergency details: desk and office surfaces.
 *  - Staff notes: staff surfaces only; never parents.
 *  - Parents see an allowlist through the parent API (`src/lib/parent`). */
export const AQUATICS_FIELD_CLASSES = {
  "Student.medicalNotes": "medical",
  "Student.contactName": "contact",
  "Student.contactEmail": "contact",
  "Student.contactPhone": "contact",
  "Student.emergencyName": "emergency",
  "Student.emergencyPhone": "emergency",
  "Student.emergencyRelationship": "emergency",
  "Student.notes": "staff-note",
  "Enrolment.placementReason": "staff-note",
  "AttendanceRecord.note": "staff-note",
  "ClassNote.note": "staff-note",
  "CompetencyResult.note": "staff-note",
} as const;

/** Desk (reception) and office (swim school management) capabilities that
 *  carry medical notes. Held flat: they apply at the working site. */
const MEDICAL_CAPABILITIES: readonly PermissionKey[] = [
  "students.manage", "enrolment.manage", "parents.manage", "courses.manage", "curriculum.manage", "progression.override",
];

export type ActivitiesSurface = "desk" | "deck";

/** The flat view (same as `permissionsOf`), computed here so this module
 *  depends only on the catalogue. */
function held(session: Session) {
  return expandPermissions(session.user.permissions ?? [], { superadmin: session.user.isSuperadmin === true });
}

/** May this session see medical notes on this surface? The deck serves
 *  someone teaching that class or assessment (its pages require a started
 *  class or today's session at the working site), so teaching is the grant. */
export function medicalAllowed(session: Session, surface: ActivitiesSurface): boolean {
  const caps = held(session);
  if (surface === "deck") return caps.has("attendance.mark") || caps.has("assessments.run");
  return MEDICAL_CAPABILITIES.some((cap) => caps.has(cap));
}

/** Replaces the medical text with a flag when the surface may not see it, so
 *  screens can still say "medical notes on file" without revealing them. */
export function classifyMedical<T extends { medicalNotes: string | null }>(row: T, allowed: boolean): T & { hasMedicalNotes: boolean } {
  const hasMedicalNotes = !!row.medicalNotes?.trim();
  return { ...row, medicalNotes: allowed ? row.medicalNotes : null, hasMedicalNotes };
}

/** Any Aquatics screen, or the deck. A Docs-only or Refunds-only role reads no
 *  swimmer data at all, whatever URL or loader it reaches. */
function hasActivitiesAccess(session: Session): boolean {
  const caps = held(session);
  return [...visibleScreens(caps)].some(isActivitiesScreen);
}

export async function requireActivitiesAccess() {
  const session = await requireSession();
  if (!hasActivitiesAccess(session)) throw new AuthorizationError("Swimmer records are part of Activities.");
  return session;
}
