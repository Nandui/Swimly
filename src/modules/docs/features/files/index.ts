/** Attachments on documents: upload and download. Entry for the module and its routes. */
export { readAttachment, uploadFile } from "@/modules/docs/features/files/server/files";
export { assertSameOrigin, requireActionMember } from "@/modules/docs/shared/auth";
export { DomainError } from "@/modules/docs/shared/domain";
export { reportError } from "@/modules/docs/shared/monitoring";
