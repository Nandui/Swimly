/** The swim school's public API (CLAUDE.md section 6): the only file other
 *  modules, Core and front may import. The composition roots use it for
 *  scheduled unenrolments at sign-in. */
export { processScheduledUnenrolments } from "@/modules/activities/features/enrolment/server/scheduled";
