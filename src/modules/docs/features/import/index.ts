/** Bringing documents into Docs: pages from Notion (scripts/docs-import-notion.ts) and the
 *  ready-made HR procedures (Administration › HR procedures). Entry for the module, its
 *  routes and its scripts. */
export { parseNotionPage, type NotionPage } from "@/modules/docs/features/import/server/notion-import";
export { hrProcedureStatus } from "@/modules/docs/features/import/server/ready-made";
export { ReadyMadeProcedures } from "@/modules/docs/features/import/components/ready-made";
