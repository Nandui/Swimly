import { readingReminderItems } from "@/lib/docs/reminders";
import { addDaysIso, formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sendStaffReminder } from "@/lib/staff-api/email";
import { meSettings } from "@/lib/staff-api/notify";
import { trainingReminderItems } from "@/lib/training/reminders";

/** Reminder emails for Turnfin Me. The daily job sends each person one short
 *  digest of things that are new since the last one: training due within 3
 *  days or overdue, a qualification crossing 60, 30 or 7 days or expired (theirs, and their
 *  team's for a line manager), and
 *  required reading past its deadline. Each item is logged, so nothing is sent
 *  twice. Shift changes are sent when they happen. A person's preferences
 *  (Reminders in Turnfin Me) turn each kind off. Emails never carry HR content.
 *  A composition root: Training and Docs each say what is due; shift changes
 *  go out from `notify.ts`. */

type Prefs = { trainingDue: boolean; qualificationExpiry: boolean; readingOverdue: boolean; shiftChanges: boolean };
const ALL_ON: Prefs = { trainingDue: true, qualificationExpiry: true, readingOverdue: true, shiftChanges: true };
type Item = { userId: string; kind: string; ref: string; line: string };

async function preferences(userIds: string[]) {
  const rows = await prisma.staffNotificationPreference.findMany({ where: { userId: { in: userIds } } });
  const byId = new Map(rows.map((r) => [r.userId, r]));
  return (userId: string): Prefs => byId.get(userId) ?? ALL_ON;
}

async function qualificationItems(on: string): Promise<Item[]> {
  const horizon = parseDateOnly(addDaysIso(on, 60));
  const rows = await prisma.qualification.findMany({
    where: { revokedAt: null, expiresOn: { not: null, lte: horizon }, user: { isActive: true } },
    select: { id: true, userId: true, typeId: true, expiresOn: true, type: { select: { name: true } }, user: { select: { name: true, managerId: true } } },
  });
  const renewed = new Set((await prisma.qualification.findMany({
    where: { revokedAt: null, OR: [{ expiresOn: null }, { expiresOn: { gt: horizon } }], userId: { in: rows.map((r) => r.userId) } },
    select: { userId: true, typeId: true },
  })).map((q) => `${q.userId}:${q.typeId}`));
  return rows.filter((r) => !renewed.has(`${r.userId}:${r.typeId}`)).flatMap((r) => {
    const expires = r.expiresOn!.toISOString().slice(0, 10);
    const threshold = expires < on ? "expired" : expires <= addDaysIso(on, 7) ? "7" : expires <= addDaysIso(on, 30) ? "30" : "60";
    const when = threshold === "expired" ? `expired on ${formatDate(r.expiresOn!)}` : `expires on ${formatDate(r.expiresOn!)}`;
    const own: Item = { userId: r.userId, kind: "qualification", ref: `${r.id}:${threshold}`, line: `Your ${r.type.name} ${when}.` };
    // Their line manager hears too (owner decision, 8 October 2026), in the same digest, logged on its own.
    const manager: Item[] = r.user.managerId && r.user.managerId !== r.userId
      ? [{ userId: r.user.managerId, kind: "qualification-team", ref: `${r.id}:${threshold}:manager`, line: `${r.user.name}'s ${r.type.name} ${when}.` }] : [];
    return [own, ...manager];
  });
}

/** Runs once a day (Vercel cron). Returns what it did, for the log. */
export async function runReminders(now = new Date()) {
  const config = meSettings();
  if (!config?.meUrl) return { sent: 0, skipped: "Turnfin Me is not enabled" };
  const on = today(now);
  const items = [...await trainingReminderItems(on), ...await qualificationItems(on), ...await readingReminderItems(on)];
  const userIds = [...new Set(items.map((i) => i.userId))];
  const [prefs, users, logged] = await Promise.all([
    preferences(userIds),
    prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { id: true, email: true } }),
    prisma.staffReminderLog.findMany({ where: { userId: { in: userIds } }, select: { userId: true, kind: true, ref: true } }),
  ]);
  const seen = new Set(logged.map((l) => `${l.userId}|${l.kind}|${l.ref}`));
  const wanted = (i: Item, p: Prefs) => (i.kind.startsWith("training") ? p.trainingDue : i.kind.startsWith("qualification") ? p.qualificationExpiry : p.readingOverdue);
  let sent = 0;
  for (const user of users) {
    const fresh = items.filter((i) => i.userId === user.id && wanted(i, prefs(user.id)) && !seen.has(`${i.userId}|${i.kind}|${i.ref}`));
    if (fresh.length === 0) continue;
    const subject = fresh.length === 1 ? "Something needs you in Turnfin Me" : `${fresh.length} things need you in Turnfin Me`;
    try {
      await sendStaffReminder(user.email, subject, fresh.map((i) => i.line).join(" "), config.meUrl);
      await prisma.staffReminderLog.createMany({ data: fresh.map((i) => ({ userId: i.userId, kind: i.kind, ref: i.ref })), skipDuplicates: true });
      sent++;
    } catch {
      // Try again tomorrow; one failure never stops the rest.
    }
  }
  return { sent, people: users.length };
}
