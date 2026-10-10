import "server-only";
import { staffCardsByIds } from "@/lib/directory";
import { subjectsFor } from "@/lib/policy/session";
import { certificateUploads, qualificationTypesOf } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";

/** Certificates staff uploaded in Turnfin Me, waiting to be checked, for the
 *  people the reader's `qualifications.manage` covers. Never their own. */
export async function certificateQueue(view: "PENDING" | "DONE" = "PENDING") {
  const who = await requireTrainingActor();
  if (!who.qualifications) return { who, rows: [], types: [] };
  const scope = await subjectsFor("qualifications.manage");
  const rows = await certificateUploads(who.orgId, scope, who.id, view);
  const [byId, types] = await Promise.all([
    staffCardsByIds(rows.map((r) => r.userId)),
    qualificationTypesOf(who.orgId ?? null).then((list) => list.map(({ id, name, validityMonths }) => ({ id, name, validityMonths }))),
  ]);
  return { who, types, rows: rows.flatMap((r) => (byId.has(r.userId) ? [{ ...r, person: byId.get(r.userId)! }] : [])) };
}
export type CertificateRow = Awaited<ReturnType<typeof certificateQueue>>["rows"][number];
