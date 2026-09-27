import { formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { staffApiConfig } from "@/lib/staff-api/config";
import { sendStaffReminder } from "@/lib/staff-api/email";
import { addDaysIso } from "@/lib/rota/constants";

/** Reminder emails for Turnfin Me. The daily job sends each person one short
 *  digest of things that are new since the last one: training due within 3
 *  days or overdue, a qualification crossing 60, 30 or 7 days or expired, and
 *  required reading past its deadline. Each item is logged, so nothing is sent
 *  twice. Shift changes are sent when they happen. A person's preferences
 *  (Reminders in Turnfin Me) turn each kind off. Emails never carry HR content. */

type Prefs = { trainingDue: boolean; qualificationExpiry: boolean; readingOverdue: boolean; shiftChanges: boolean };
const ALL_ON: Prefs = { trainingDue: true, qualificationExpiry: true, readingOverdue: true, shiftChanges: true };
type Item = { userId: string; kind: string; ref: string; line: string };

function enabled() {
  try { return staffApiConfig(); } catch { return null; }
}

async function preferences(userIds: string[]) {
  const rows = await prisma.staffNotificationPreference.findMany({ where: { userId: { in: userIds } } });
  const byId = new Map(rows.map((r) => [r.userId, r]));
  return (userId: string): Prefs => byId.get(userId) ?? ALL_ON;
}

async function trainingItems(on: string): Promise<Item[]> {
  const soon = parseDateOnly(addDaysIso(on, 3));
  const rows = await prisma.trainingAssignment.findMany({
    where: { status: "ASSIGNED", dueOn: { not: null, lte: soon }, user: { isActive: true } },
    select: { id: true, userId: true, dueOn: true, course: { select: { title: true } } },
  });
  return rows.map((r) => {
    const overdue = r.dueOn!.toISOString().slice(0, 10) < on;
    return { userId: r.userId, kind: overdue ? "training-overdue" : "training-due", ref: r.id,
      line: overdue ? `${r.course.title} is overdue (it was due ${formatDate(r.dueOn!)}).` : `${r.course.title} is due ${formatDate(r.dueOn!)}.` };
  });
}

async function qualificationItems(on: string): Promise<Item[]> {
  const horizon = parseDateOnly(addDaysIso(on, 60));
  const rows = await prisma.qualification.findMany({
    where: { revokedAt: null, expiresOn: { not: null, lte: horizon }, user: { isActive: true } },
    select: { id: true, userId: true, typeId: true, expiresOn: true, type: { select: { name: true } } },
  });
  const renewed = new Set((await prisma.qualification.findMany({
    where: { revokedAt: null, OR: [{ expiresOn: null }, { expiresOn: { gt: horizon } }], userId: { in: rows.map((r) => r.userId) } },
    select: { userId: true, typeId: true },
  })).map((q) => `${q.userId}:${q.typeId}`));
  return rows.filter((r) => !renewed.has(`${r.userId}:${r.typeId}`)).map((r) => {
    const expires = r.expiresOn!.toISOString().slice(0, 10);
    const threshold = expires < on ? "expired" : expires <= addDaysIso(on, 7) ? "7" : expires <= addDaysIso(on, 30) ? "30" : "60";
    return { userId: r.userId, kind: "qualification", ref: `${r.id}:${threshold}`,
      line: threshold === "expired" ? `Your ${r.type.name} expired on ${formatDate(r.expiresOn!)}.` : `Your ${r.type.name} expires on ${formatDate(r.expiresOn!)}.` };
  });
}

async function readingItems(on: string): Promise<Item[]> {
  if (!process.env.DOCS_DATABASE_URL) return [];
  const { directoryDatabase } = await import("@/lib/docs/runtime-database");
  const { rows } = await directoryDatabase().query<{ id: string; member_id: string; due_date: string | Date; title: string }>(
    "SELECT r.id, r.member_id, r.due_date, s.content->>'title' AS title FROM requirements r JOIN snapshots s ON s.id=r.version_id WHERE r.status='outstanding' AND r.due_date IS NOT NULL AND r.due_date < $1",
    [on],
  );
  return rows.map((r) => ({ userId: r.member_id, kind: "reading-overdue", ref: r.id, line: `${r.title} is overdue to read and acknowledge.` }));
}

/** Runs once a day (Vercel cron). Returns what it did, for the log. */
export async function runReminders(now = new Date()) {
  const config = enabled();
  if (!config?.meUrl) return { sent: 0, skipped: "Turnfin Me is not enabled" };
  const on = today(now);
  const items = [...await trainingItems(on), ...await qualificationItems(on), ...await readingItems(on)];
  const userIds = [...new Set(items.map((i) => i.userId))];
  const [prefs, users, logged] = await Promise.all([
    preferences(userIds),
    prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { id: true, email: true } }),
    prisma.staffReminderLog.findMany({ where: { userId: { in: userIds } }, select: { userId: true, kind: true, ref: true } }),
  ]);
  const seen = new Set(logged.map((l) => `${l.userId}|${l.kind}|${l.ref}`));
  const wanted = (i: Item, p: Prefs) => (i.kind.startsWith("training") ? p.trainingDue : i.kind === "qualification" ? p.qualificationExpiry : p.readingOverdue);
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

/** A shift was added, changed or cancelled for this person. Best effort: a
 *  mail problem never undoes the rota change. */
export async function notifyShiftChange(userId: string | null, line: string) {
  if (!userId) return;
  const config = enabled();
  if (!config?.meUrl) return;
  try {
    const [user, pref] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } }),
      prisma.staffNotificationPreference.findUnique({ where: { userId } }),
    ]);
    if (!user?.isActive || pref?.shiftChanges === false) return;
    await sendStaffReminder(user.email, "Your shifts changed", line, `${config.meUrl}/shifts`);
  } catch {
    // Best effort.
  }
}
