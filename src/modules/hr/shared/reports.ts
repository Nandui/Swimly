import "server-only";
import { filterAllows } from "@/lib/policy/engine";
import { sitesFor, subjectsFor } from "@/lib/policy/session";
import type { HrSql } from "@/modules/hr/shared/database";

/** Reports waiting to be read (D22). They wait for the "Their sites" holders at
 *  the site they were filed from: a reader whose files reach only some sites.
 *  Readers of everyone (and superadmins) see reports on the file but are
 *  neither alerted nor clear the wait. */
async function waitingSites(): Promise<string[]> {
  const sites = await sitesFor("hr.records.read");
  return sites.kind === "some" ? [...sites.siteIds] : [];
}

/** People with unread reports this reader waits on, and how many each. Only
 *  people whose file the reader can open. */
export async function unreadReports(db: HrSql, reader: { id: string; orgId: string }): Promise<Map<string, number>> {
  const sites = await waitingSites();
  if (sites.length === 0) return new Map();
  const [rows, covered] = await Promise.all([
    db.query<{ subjectUserId: string; n: number }>(
      `SELECT subject_user_id AS "subjectUserId", count(*)::int AS n FROM notes
        WHERE org_id=$1 AND via='report' AND first_read_at IS NULL AND withdrawn_at IS NULL AND site_id = ANY($2) AND author_id <> $3
        GROUP BY subject_user_id`, [reader.orgId, sites, reader.id]),
    subjectsFor("hr.records.read"),
  ]);
  return new Map(rows.filter((r) => filterAllows(covered, r.subjectUserId)).map((r) => [r.subjectUserId, r.n]));
}

/** Opening a file reads its waiting reports from the reader's sites. Callers
 *  have checked `hr.records.read` over the person. */
export async function markReportsRead(db: HrSql, reader: { id: string; orgId: string }, subjectUserId: string) {
  const sites = await waitingSites();
  if (sites.length === 0) return;
  await db.query(
    `UPDATE notes SET first_read_at=now(), first_read_by=$3
      WHERE org_id=$1 AND subject_user_id=$2 AND via='report' AND first_read_at IS NULL AND withdrawn_at IS NULL AND site_id = ANY($4) AND author_id <> $3`,
    [reader.orgId, subjectUserId, reader.id, sites]);
}
