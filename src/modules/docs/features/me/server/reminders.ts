import "server-only";

/** Required reading past its deadline, for Turnfin Me's daily digest. None
 *  while the Docs database is not configured. */
export async function readingReminderItems(on: string) {
  if (!process.env.DOCS_DATABASE_URL) return [];
  const { directoryDatabase } = await import("@/modules/docs/shared/runtime-database");
  const { rows } = await directoryDatabase().query<{ id: string; member_id: string; due_date: string | Date; title: string }>(
    "SELECT r.id, r.member_id, r.due_date, s.content->>'title' AS title FROM requirements r JOIN snapshots s ON s.id=r.version_id WHERE r.status='outstanding' AND r.due_date IS NOT NULL AND r.due_date < $1",
    [on],
  );
  return rows.map((r) => ({ userId: r.member_id, kind: "reading-overdue", ref: r.id, line: `${r.title} is overdue to read and acknowledge.` }));
}
