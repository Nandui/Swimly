import "server-only";
import { sitesByIds, staffByIds } from "@/lib/directory";
import { sendGoogleTextEmail } from "@/lib/email/google";
import { emailSender } from "@/lib/email/sender";
import { addDaysIso, dublinInstant, today } from "@/lib/format";
import { hrConfigured, hrDatabase } from "@/modules/hr/shared/database";
import { digestEmail, recipientList, type DigestReport } from "@/modules/hr/features/digest/rules";

/** The daily email (Vercel cron, /api/cron/hr): for each organisation with
 *  addresses in HR > Settings, every report filed yesterday (Dublin day, by when
 *  it was filed, so a late report is never missed) and not withdrawn, by
 *  person. Each day is claimed once, so running it twice sends nothing new; a
 *  day with no reports sends nothing. The outcome is kept for Settings to show. */
export async function runDailyDigest(origin: string, now = new Date()) {
  const day = addDaysIso(today(now), -1);
  const from = dublinInstant(day, 0), until = dublinInstant(today(now), 0);
  if (!from || !until || !hrConfigured()) return { day, sent: 0, failed: 0 };
  const db = hrDatabase();
  const orgs = await db.query<{ orgId: string; to: string }>(`SELECT org_id AS "orgId", digest_to AS "to" FROM settings WHERE digest_to <> ''`);
  let sent = 0, failed = 0;
  for (const org of orgs) {
    const [claimed] = await db.query(`INSERT INTO digest_runs (org_id, day) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING org_id`, [org.orgId, day]);
    if (!claimed) continue;
    let error: string | null = null, sentTo = "", count = 0;
    try {
      const rows = await db.query<{ id: string; subjectUserId: string; kind: string; body: string; occurredAt: Date; siteId: string; authorName: string }>(
        `SELECT id, subject_user_id AS "subjectUserId", kind, body, occurred_at AS "occurredAt", site_id AS "siteId", author_name AS "authorName"
           FROM notes WHERE org_id=$1 AND via='report' AND withdrawn_at IS NULL AND created_at >= $2 AND created_at < $3`, [org.orgId, from, until]);
      count = rows.length;
      if (rows.length) {
        const config = emailSender("Turnfin HR");
        if (!config) throw new Error("Email is not set up.");
        const [people, sites] = await Promise.all([staffByIds(rows.map((r) => r.subjectUserId)), sitesByIds(rows.map((r) => r.siteId))]);
        const reports: DigestReport[] = rows.map((r) => ({ ...r, occurredAt: new Date(r.occurredAt),
          subject: people.get(r.subjectUserId)?.name ?? "Former staff", site: sites.get(r.siteId)?.name ?? "Unknown site" }));
        const message = digestEmail(day, reports, origin);
        const problems: string[] = [];
        for (const address of recipientList(org.to)) {
          try { await sendGoogleTextEmail(address, message.subject, message.text, config); sentTo = sentTo ? `${sentTo}, ${address}` : address; }
          catch (failure) { problems.push(`${address}: ${failure instanceof Error ? failure.message : "sending failed"}`); }
        }
        if (problems.length) error = problems.join("; ");
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "Sending failed.";
    }
    await db.query(`UPDATE digest_runs SET reports=$3, sent_to=$4, error=$5, ran_at=now() WHERE org_id=$1 AND day=$2`,
      [org.orgId, day, count, sentTo, error?.slice(0, 500) ?? null]);
    if (error) failed++; else if (count) sent++;
  }
  return { day, sent, failed };
}
