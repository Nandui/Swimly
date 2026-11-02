import "server-only";
import { notFound } from "next/navigation";
import type { Session } from "next-auth";
import { requireSession, AuthorizationError } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the HR workspace. Every HR capability is restricted: it
 *  reaches a person only through a role a superadmin assigned (or the
 *  superadmin flag), and each read also needs a recent password. Reading
 *  records or filing reports anywhere opens the workspace; every page then
 *  limits records to the people it covers. Someone who only files reports
 *  (HR Report, D22) reads no records. What is shared with you lives in Turnfin Me (the staff app). */
export type HrActor = {
  id: string;
  name: string;
  orgId: string;
  superadmin: boolean;
  /** Reads HR records: the People page and every file. */
  records: boolean;
  /** Files quick reports (HR Report and up). */
  reports: boolean;
  notes: boolean;
  reviews: boolean;
  /** Keeps staff details (position, employment, contact) for someone. */
  details: boolean;
};

export function hrAccess(session: Session): HrActor | null {
  const actor = actorForSession(session);
  const records = holdsAnywhere(actor, "hr.records.read");
  const reports = holdsAnywhere(actor, "hr.reports.write");
  if (!records && !reports) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId ?? "", superadmin: actor.superadmin, records, reports,
    notes: holdsAnywhere(actor, "hr.notes.write"),
    reviews: holdsAnywhere(actor, "hr.reviews.write"),
    details: holdsAnywhere(actor, "hr.details.write"),
  };
}

/** For record reads. Someone who only files reports finds no such page. */
export async function requireHrActor() {
  const who = hrAccess(await requireSession());
  if (!who) throw new AuthorizationError("HR access is required.");
  if (!who.records) notFound();
  return who;
}
