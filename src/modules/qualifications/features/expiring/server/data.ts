import "server-only";
import { livePositionsOf, liveSitesWithin } from "@/lib/directory";
import { addDaysIso, parseDateOnly, today } from "@/lib/format";
import { qualificationState } from "@/lib/people/data";
import { requirementStates } from "@/lib/people/requirements";
import { subjectsFor } from "@/lib/policy/session";
import type { SubjectFilter } from "@/lib/policy/types";
import { positionRequirements, qualificationsExpiringBy, type StaffFilters } from "@/lib/qualifications";
import { qualificationRenewals } from "@/modules/contributions";
import { requireQualificationsActor } from "@/modules/qualifications/shared/access";
import { EXPIRY_WARNING_DAYS } from "@/modules/qualifications/shared/constants";

/** Expired and expiring qualifications for the people this person covers, filtered by site and
 *  position, each with the Training course that renews it; and (owner decision, 8 October 2026)
 *  who lacks a qualification their position needs. A newer certificate of the same type takes
 *  a person off the list. With Training switched off, no row offers a course. */
export async function expiringQualifications(filters: StaffFilters = {}) {
  const who = await requireQualificationsActor();
  const on = today();
  const scope = await subjectsFor("qualifications.manage");
  const [rows, sites, positions, holders] = await Promise.all([
    expiringRows(who.orgId, scope, on, filters),
    liveSitesWithin(who.orgId ?? null, { kind: "all" }),
    livePositionsOf(who.orgId ?? null),
    positionRequirements(who.orgId ?? null, scope, filters),
  ]);
  // Never held at all: expired and expiring ones are already in the list above.
  const missing = holders.flatMap((p) => {
    const lacking = requirementStates(p.position!.requires.map((r) => r.type), p.qualifications, on).filter((r) => r.state === "missing");
    return lacking.length ? [{ userId: p.id, name: p.name, position: p.position!.name, lacking: lacking.map((r) => r.name) }] : [];
  });
  const renewals = await qualificationRenewals();
  const renewal = renewals ? await renewals.find(who.orgId, rows) : () => null;
  return {
    who, sites, positions, missing,
    rows: rows.map((r) => ({
      id: r.id, userId: r.userId, name: r.user.name, jobTitle: r.user.jobTitle, qualification: r.type.name,
      expiresOn: r.expiresOn, state: qualificationState(r, on), renewal: renewal(r),
    })),
  };
}

/** How many qualifications are expired or expiring for the people this person covers, for Home. */
export async function expiringCount() {
  const who = await requireQualificationsActor();
  return (await expiringRows(who.orgId, await subjectsFor("qualifications.manage"), today())).length;
}

const expiringRows = (orgId: string | null, reach: SubjectFilter, on: string, filters: StaffFilters = {}) =>
  qualificationsExpiringBy(orgId, reach, parseDateOnly(addDaysIso(on, EXPIRY_WARNING_DAYS)), filters);
