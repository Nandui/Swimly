/** A person's own work: drafts, reviews and approvals waiting on them. Entry
 *  for the module and its routes. */
export { WorkView } from "@/modules/docs/features/work/components/work";
export { requireMember } from "@/modules/docs/shared/auth";
export { database, rows } from "@/modules/docs/shared/database";
export { workspace } from "@/modules/docs/shared/queries";
export { canWrite, type Draft } from "@/modules/docs/shared/types";
