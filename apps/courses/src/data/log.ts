import type { Tx } from "./db";

/** One row in `courses_log` for one change. Pass the transaction the change is made in, so
 *  neither exists without the other. */
export type LogEntry = {
  orgId: string;
  /** Who did it (their Turnfin person id and name); null for a script, which names itself in `actorName`. */
  account: { id: string; name: string } | null;
  actorName?: string;
  /** `<thing>.<past-tense-verb>`. */
  action: string;
  record?: string;
  recordId?: string;
  siteId?: string;
  /** Ids and the minimum that explains the change: never a swimmer's notes or contact details. */
  detail?: Record<string, string | number | boolean | null | string[]>;
};

export async function log(tx: Tx, entry: LogEntry): Promise<void> {
  await tx.coursesLog.create({
    data: {
      orgId: entry.orgId,
      userId: entry.account?.id ?? null,
      actorName: entry.account?.name ?? entry.actorName ?? "System",
      action: entry.action,
      record: entry.record,
      recordId: entry.recordId,
      siteId: entry.siteId,
      detail: entry.detail,
    },
  });
}
