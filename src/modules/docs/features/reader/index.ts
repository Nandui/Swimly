/** Reading a document, acknowledging it, and the review and approval steps on
 *  it. Entry for the module and its routes. */
export { Reader } from "@/modules/docs/features/reader/components/reader";
export { requireMember } from "@/modules/docs/shared/auth";
export { DocumentBody, RiskAssessmentView, tableOfContents } from "@/modules/docs/shared/components/document-body";
export { database } from "@/modules/docs/shared/database";
export { documentView, DomainError } from "@/modules/docs/shared/domain";
export { workspace } from "@/modules/docs/shared/queries";
