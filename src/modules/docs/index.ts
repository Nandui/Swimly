/** Docs' public API (AGENTS.md, How apps talk): the only file other modules, Core
 *  and front may import. Turnfin Me's staff API reads a person's required
 *  reading through it. */
export { docsReading, readingReminderItems } from "@/modules/docs/features/me";
