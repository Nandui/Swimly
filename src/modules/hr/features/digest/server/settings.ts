import "server-only";
import { liveSitesOf } from "@/lib/directory";
import { hrDatabase } from "@/modules/hr/shared/database";
import type { HrActor } from "@/modules/hr/shared/access";
import { audit } from "@/modules/hr/shared/writes";
import { bySite, recipientList, recipientsProblem } from "@/modules/hr/features/digest/rules";

/** Who gets the daily email of yesterday's reports: lists of addresses kept in
 *  HR > Settings (owner decisions, 9 November 2026), not a role. One list gets
 *  every report; each site's own list gets the reports on people whose main
 *  site it is. Only holders of `hr.digest.manage` (a tick on chosen roles, and
 *  superadmins) see or change them, since the email carries reports in full. */

export class DigestSettingError extends Error {}

export async function digestSetting(orgId: string) {
  const db = hrDatabase();
  const [[row], [last], sites] = await Promise.all([
    db.query<{ to: string; toBySite: unknown; changedByName: string; updatedAt: Date }>(
      `SELECT digest_to AS "to", digest_to_by_site AS "toBySite", changed_by_name AS "changedByName", updated_at AS "updatedAt" FROM settings WHERE org_id=$1`, [orgId]),
    db.query<{ day: string; reports: number; sentTo: string; error: string | null }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, reports, sent_to AS "sentTo", error FROM digest_runs WHERE org_id=$1 ORDER BY day DESC LIMIT 1`, [orgId]),
    liveSitesOf(orgId),
  ]);
  const perSite = bySite(row?.toBySite);
  return {
    to: recipientList(row?.to ?? ""),
    sites: sites.map((site) => ({ id: site.id, name: site.name, to: recipientList(perSite[site.id] ?? "") })),
    changedByName: row?.changedByName ?? null, changedAt: row?.updatedAt ?? null, last: last ?? null,
  };
}

export async function saveDigestRecipients(who: Pick<HrActor, "id" | "name" | "orgId" | "digest">, typed: string, typedBySite: Record<string, string> = {}) {
  if (!who.digest || !who.orgId) throw new DigestSettingError("Changing who gets the daily HR email needs the HR tick \"Keeps the daily reports email\".");
  const list = recipientList(typed);
  const sites = await liveSitesOf(who.orgId);
  const perSite = sites.map((site) => ({ site, list: recipientList(typedBySite[site.id] ?? "") }));
  const problem = recipientsProblem(list)
    ?? perSite.map((p) => { const wrong = recipientsProblem(p.list); return wrong && `${p.site.name}: ${wrong}`; }).find(Boolean);
  if (problem) throw new DigestSettingError(problem);
  const to = list.join(", ");
  const toBySite = Object.fromEntries(perSite.filter((p) => p.list.length).map((p) => [p.site.id, p.list.join(", ")]));
  const siteSummary = perSite.filter((p) => p.list.length).map((p) => `; ${p.site.name} staff also to ${p.list.join(", ")}`).join("");
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`INSERT INTO settings (org_id, digest_to, digest_to_by_site, changed_by_id, changed_by_name) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (org_id) DO UPDATE SET digest_to=EXCLUDED.digest_to, digest_to_by_site=EXCLUDED.digest_to_by_site, changed_by_id=EXCLUDED.changed_by_id, changed_by_name=EXCLUDED.changed_by_name, updated_at=now()`,
      [who.orgId, to, JSON.stringify(toBySite), who.id, who.name]);
    await audit(tx, who, "update", "HrSettings", who.orgId, "",
      `The daily HR reports email now goes to ${to || "nobody"} for every site${siteSummary}`);
  });
}
