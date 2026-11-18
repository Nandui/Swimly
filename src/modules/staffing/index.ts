/** Staffing's front door (docs/architecture.md, How apps talk): the only file other apps, the
 *  platform and the front may import. The status maps are for the platform's tone check, which
 *  reads them where they are kept (shared/rules.ts), because this file also serves the daily
 *  reminder email (server code). */
export { STAFFING_STATUS_MAPS } from "@/modules/staffing/shared/rules";

/** The preference check line for the daily reminder email to Turnfin Me (D35). */
export { preferenceCheckReminderItems } from "@/modules/staffing/features/preferences/server/reminders";
