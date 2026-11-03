import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { sendGoogleEmail } from "@/lib/email/google";
import { isSystemActor } from "@/lib/audit";
import { sitePhones, sitesByIds } from "@/lib/directory";
import { formatDay, formatTimeRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { readSharedCurriculum } from "@/modules/activities/shared/curriculum/data/shared";
import { parentEmailConfig } from "@/modules/activities/shared/parents/email";
import { familyEmailHtml, familyEmailText, type FamilyEmail } from "@/modules/activities/shared/parents/family-email";
import { PARENT_EMAIL_LOGO_CID } from "@/modules/activities/shared/parents/sign-in-email";

/** "Your assessment is booked": emailed to the family after any assessment
 *  booking, whether they booked it in the parents app or reception booked it
 *  (owner request, 24 October 2026). Sent from the parents app's mailbox, like
 *  the sign-in code.
 *
 *  Best effort and after the booking commits: the place is booked whether or
 *  not this arrives. Only the production deployment sends, because previews
 *  run on real families' records. Bookings by an account marked as system
 *  (scripted development work) send nothing. */

const address = z.string().email().max(254);

export type AssessmentConfirmation = {
  child: string; day: string; time: string; site: string; location: string | null;
  assessment: string; phone: string; bookedInApp: boolean;
};

export function assessmentConfirmationEmail(d: AssessmentConfirmation) {
  const where = d.location ? `${d.site} (${d.location})` : d.site;
  const details: [string, string][] = [["Swimmer", d.child], ["Assessment", d.assessment], ["Day", d.day], ["Time", d.time], ["Where", where]];
  const arrive = "Please arrive 10 minutes early, ready to swim.";
  const change = d.phone
    ? `If you need to change or cancel, please phone reception on ${d.phone}.`
    : `If you need to change or cancel, please contact reception at ${d.site}.`;
  const app = d.bookedInApp ? "You can also see this booking in the parents app under Bookings." : "";
  const lead = `${d.child}'s swimming assessment is booked. Here are the details.`;
  const email: FamilyEmail = {
    title: "Assessment booked", preheader: `${d.day}, ${d.time} at ${d.site}`,
    before: [lead], details, after: [arrive, change, app], signOff: "See you at the pool,", footer: "LeisureWorld Aquatics · Swimming assessments",
  };
  const text = familyEmailText(email);
  const html = familyEmailHtml(email);
  return { subject: `Assessment booked: ${d.child}, ${d.day}`, text, html };
}

/** Who hears about it: the parent who booked in the app; for a reception
 *  booking, the swimmer's contact email, or the parent accounts linked to
 *  them when it has none. */
async function recipients(booking: { student: { contactEmail: string | null; parentAccess: { parentEmail: string }[] } }, parentEmail?: string) {
  const list = parentEmail ? [parentEmail]
    : booking.student.contactEmail?.trim() ? [booking.student.contactEmail.trim()]
    : booking.student.parentAccess.map((a) => a.parentEmail);
  return [...new Set(list.map((e) => e.toLowerCase()))].filter((e) => address.safeParse(e).success && !/[\r\n]/.test(e)).slice(0, 3);
}

export async function sendAssessmentConfirmation(bookingId: string, by: { parentEmail: string } | { actorId: string }, env: Record<string, string | undefined> = process.env) {
  try {
    if (env.VERCEL_ENV !== "production") return;
    if ("actorId" in by && await isSystemActor(by.actorId)) return;
    const booking = await prisma.assessmentBooking.findUnique({ where: { id: bookingId }, select: {
      status: true,
      student: { select: { firstName: true, lastName: true, contactEmail: true, parentAccess: { where: { revokedAt: null }, select: { parentEmail: true } } } },
      session: { select: { date: true, startMinutes: true, durationMinutes: true, location: true, clubId: true, programmeId: true, typeId: true, cancelledAt: true } },
    } });
    if (!booking || booking.status !== "BOOKED" || booking.session.cancelledAt) return;
    const to = await recipients(booking, "parentEmail" in by ? by.parentEmail : undefined);
    if (!to.length) return;
    const { session } = booking;
    const [sites, phones, curriculum] = await Promise.all([sitesByIds([session.clubId]), sitePhones([session.clubId]), readSharedCurriculum()]);
    const type = session.typeId ? curriculum.types.find((t) => t.id === curriculum.typeIds.resolve(session.typeId!)) : null;
    const email = assessmentConfirmationEmail({
      child: booking.student.firstName, day: formatDay(session.date),
      time: formatTimeRange(session.startMinutes, session.startMinutes + session.durationMinutes),
      site: sites.get(session.clubId)?.name ?? "the pool", location: session.location?.trim() || null,
      assessment: type?.name ?? curriculum.programme(session.programmeId)?.name ?? "Swimming assessment",
      phone: phones.get(session.clubId)?.trim() ?? "", bookedInApp: "parentEmail" in by,
    });
    const config = parentEmailConfig();
    const logo = await readFile(join(process.cwd(), "assets/email/leisureworld-white-no-tagline.png"));
    for (const recipient of to) {
      await sendGoogleEmail(recipient, email.subject, { text: email.text, html: email.html, inlineImages: [{
        cid: PARENT_EMAIL_LOGO_CID, filename: "leisureworld.png", contentType: "image/png", content: logo,
      }] }, config);
    }
  } catch {
    // Provider responses can contain credentials: log the booking, not the error.
    console.error("Assessments: the booking confirmation email was not sent", { bookingId });
  }
}
