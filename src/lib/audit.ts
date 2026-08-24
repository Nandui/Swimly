/** Every mutation is audited — including the ones a script performs.
 *
 *  The rule is worth stating because the temptation to skip it always arrives
 *  disguised: a bulk import, a one-off fix, a migration script. If a row
 *  changed and the log does not say so, the log is no longer answerable, and
 *  an audit trail nobody trusts is worse than none.
 *
 *  `summary` is the whole point. It is written for a person reading the log
 *  months later, so it names what changed and to what — "email old → new", not
 *  "user updated". Diff old against new and say which fields moved. */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorId?: string | null;
  /** Denormalised on purpose: the log must still read correctly after the
   *  actor's account is deleted. */
  actorName: string;
  action: string; // "create" | "update" | "delete", or a domain verb
  entity: string; // the model name, e.g. "Student"
  entityId?: string | null;
  /** How the log is filtered, because it is how the app is navigated. A plain
   *  nullable String rather than a foreign key, for the same reason
   *  `actorName` is denormalised: the log must survive the programme. */
  programmeId?: string | null;
  summary: string;
};

/** @param db Pass the transaction client when the audit row must live or die
 *  with the write it describes. The default writes on its own connection,
 *  which is what you want after a locked transaction has already committed —
 *  but inside `$transaction` it would escape the rollback and leave the log
 *  describing a change that never happened. */
export async function logAudit(
  input: AuditInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  await db.auditLog.create({ data: input });
}
