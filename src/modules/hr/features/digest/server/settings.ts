import "server-only";
import { hrDatabase } from "@/modules/hr/shared/database";
import type { HrActor } from "@/modules/hr/shared/access";
import { audit } from "@/modules/hr/shared/writes";
import { recipientList, recipientsProblem } from "@/modules/hr/features/digest/rules";

/** Who gets the daily email of yesterday's reports: a list of addresses the
 *  owner keeps in HR > Settings (owner decision, 9 November 2026), not a role.
 *  Only a superadmin sees or changes it, since the email carries every report in full. */

export class DigestSettingError extends Error {}

export async function digestSetting(orgId: string) {
  const [row] = await hrDatabase().query<{ to: string; changedByName: string; updatedAt: Date }>(
    `SELECT digest_to AS "to", changed_by_name AS "changedByName", updated_at AS "updatedAt" FROM settings WHERE org_id=$1`, [orgId]);
  const [last] = await hrDatabase().query<{ day: string; reports: number; sentTo: string; error: string | null }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, reports, sent_to AS "sentTo", error FROM digest_runs WHERE org_id=$1 ORDER BY day DESC LIMIT 1`, [orgId]);
  return { to: recipientList(row?.to ?? ""), changedByName: row?.changedByName ?? null, changedAt: row?.updatedAt ?? null, last: last ?? null };
}

export async function saveDigestRecipients(who: Pick<HrActor, "id" | "name" | "orgId" | "superadmin">, typed: string) {
  if (!who.superadmin || !who.orgId) throw new DigestSettingError("Only a superadmin changes who gets the daily HR email.");
  const list = recipientList(typed);
  const problem = recipientsProblem(list);
  if (problem) throw new DigestSettingError(problem);
  const to = list.join(", ");
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`INSERT INTO settings (org_id, digest_to, changed_by_id, changed_by_name) VALUES ($1,$2,$3,$4)
      ON CONFLICT (org_id) DO UPDATE SET digest_to=EXCLUDED.digest_to, changed_by_id=EXCLUDED.changed_by_id, changed_by_name=EXCLUDED.changed_by_name, updated_at=now()`,
      [who.orgId, to, who.id, who.name]);
    await audit(tx, who, "update", "HrSettings", who.orgId, "", to ? `The daily HR reports email now goes to ${to}` : "The daily HR reports email now goes to nobody");
  });
}
