/** Writing: a new document, and editing a draft. Entry for the module and its routes. */
export { DocumentEditor } from "@/modules/docs/features/editor/components/document-editor";
export { NewDocument } from "@/modules/docs/features/editor/components/new-document";
export { requireMember } from "@/modules/docs/shared/auth";
export { database, one } from "@/modules/docs/shared/database";
export { workspace } from "@/modules/docs/shared/queries";
export { canWrite, type DocumentRecord, type Draft } from "@/modules/docs/shared/types";
