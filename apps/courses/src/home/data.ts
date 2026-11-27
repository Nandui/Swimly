import { may, siteFilter } from "@/access/grants";
import type { Account } from "@/access/session";
import { db } from "@/data/db";
import { waitingFor } from "@/place/queue";

/** One job on the desk home: how many are waiting, in the desk's words, and where it opens.
 *  `here` is its page in Courses; without one it opens `turnfin`, its page there, for now. */
export type Job = { key: "places" | "payments" | "calls" | "updates" | "billing"; count: number; title: string; line: string; nothing: string; here?: string; turnfin?: string };

/** The jobs waiting for this person, in the order the desk works them. A job shows only to
 *  someone whose role opens it; one with nothing waiting still shows, so the tiles never move. */
export async function jobsFor(account: Account): Promise<Job[]> {
  const sites = siteFilter(account.access);
  const desk = may(account.access, "desk");
  const tutor = may(account.access, "tutor");
  const [places, payments, updates, billing, calls] = await Promise.all([
    desk ? waitingFor(account).then((queue) => queue.length) : null,
    desk ? db.paymentFailure.count({ where: { orgId: account.orgId, siteId: sites, status: "to_contact" } }) : null,
    // Swimmers are shared between sites, so a parent's correction is anyone's on the desk to check.
    desk ? db.parentChangeRequest.count({ where: { status: "PENDING", student: { club: { orgId: account.orgId } } } }) : null,
    // Places whose billing agreement in Legend is still to confirm, as Turnfin lists them.
    desk ? db.enrolment.count({ where: { status: "ACTIVE", legendAgreementStatus: { in: ["NEEDS_CHECK", "PENDING"] }, course: { clubId: sites, club: { orgId: account.orgId } } } }) : null,
    tutor
      ? db.academyCandidate.count({
          where: { source: "online", payment: "owed", status: "booked", course: { cancelledAt: null, status: { not: "completed" }, siteId: sites } },
        })
      : null,
  ]);
  const jobs: Job[] = [];
  if (places !== null) jobs.push({ key: "places", count: places, title: "Place a swimmer", line: "waiting for a class", nothing: "Nobody is waiting", here: "/place" });
  if (payments !== null) jobs.push({ key: "payments", count: payments, title: "Failed payments", line: "to contact", nothing: "None to contact", turnfin: "/payments?show=to_contact" });
  if (calls !== null) jobs.push({ key: "calls", count: calls, title: "Phone back", line: "about a course", nothing: "Nobody to phone", turnfin: "/academy/calls" });
  if (updates !== null) jobs.push({ key: "updates", count: updates, title: "Parent updates", line: "to check", nothing: "None to check", turnfin: "/students/parent-changes" });
  if (billing !== null) jobs.push({ key: "billing", count: billing, title: "Billing to confirm", line: "in Legend", nothing: "All confirmed", turnfin: "/legend-agreements" });
  return jobs;
}

/** A swimmer found by the desk's search: only what names them. No contact details, no notes. */
export type Found = { id: string; name: string; memberNumber: string | null; site: string };

/** Find swimmers by name, family contact's name or member number. Every word must match
 *  somewhere. Swimmers are shared between sites (a swimmer's site is only where they first
 *  registered), so the desk finds every swimmer in the organisation, as it does in Turnfin.
 *  Needs the desk grant; the caller has checked it. */
export async function findSwimmers(account: Account, query: string): Promise<Found[]> {
  const terms = query.trim().slice(0, 100).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const rows = await db.student.findMany({
    where: {
      club: { orgId: account.orgId },
      AND: terms.map((term) => ({ OR: [
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
        { contactName: { contains: term, mode: "insensitive" as const } },
        { memberNumber: { contains: term, mode: "insensitive" as const } },
      ] })),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    take: 25,
    select: { id: true, firstName: true, lastName: true, memberNumber: true, club: { select: { name: true } } },
  });
  return rows.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`.trim(), memberNumber: row.memberNumber, site: row.club.name }));
}
