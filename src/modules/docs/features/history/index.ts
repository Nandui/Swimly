/** A document's versions, and comparing them. Entry for the module and its routes. */
export { HistoryView } from "@/modules/docs/features/history/components/history";
export { requireMember } from "@/modules/docs/shared/auth";
export { database, rows } from "@/modules/docs/shared/database";
export { documentView, DomainError } from "@/modules/docs/shared/domain";
export { workspace } from "@/modules/docs/shared/queries";
export { type AuditEvent, canWrite } from "@/modules/docs/shared/types";
