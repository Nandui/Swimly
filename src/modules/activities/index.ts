/** The swim school's public API (CLAUDE.md section 6): the only file other
 *  modules, Core and front may import. The composition roots use it for the
 *  swim school's top-bar tools and daily pages on the home frame, and for
 *  scheduled unenrolments at sign-in. */
export { processScheduledUnenrolments } from "@/modules/activities/features/enrolment";
export { dailyPages, SwimSchoolTools } from "@/modules/activities/features/workspace";
