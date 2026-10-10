/** Docs administration: categories, groups, templates and settings. Entry for
 *  the module and its routes. */
export { AdminView } from "@/modules/docs/features/admin/components/admin";
export { requireMember } from "@/modules/docs/shared/auth";
export { database, rows } from "@/modules/docs/shared/database";
export { workspace } from "@/modules/docs/shared/queries";
export { type AuditEvent, canManage } from "@/modules/docs/shared/types";
