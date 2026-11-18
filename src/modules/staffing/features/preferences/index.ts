/** When staff can work: the times each person on the rota gave, against the preference check and
 *  their contracted hours (D35), and the check's line in Turnfin Me's reminder email. */
export { availabilityPage } from "@/modules/staffing/features/preferences/server/data";
export { preferenceCheckReminderItems } from "@/modules/staffing/features/preferences/server/reminders";

// What its page shows, from the module's shared rules.
export { CHECK_CHANGE_META, CONTRACT_FIT_META, CONTRACT_KIND_META, formatHours } from "@/modules/staffing/shared/rules";
