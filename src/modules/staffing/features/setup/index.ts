/** Set up: slots, staff, exam seasons and settings. */
export { seasonsPage, settingsPage, slotsPage, staffPage } from "@/modules/staffing/features/setup/server/data";
export { NUMBERS, TIMES } from "@/modules/staffing/features/setup/fields";
export { ArchiveSlot, DeleteSeason, RemoveStaff, SeasonDialog, SettingsDialog, SlotDialog, StaffDialog } from "@/modules/staffing/features/setup/components/setup-dialogs";

// What its pages show, from the module's shared rules and screen kit.
export { RoleTag } from "@/modules/staffing/shared/components/kit";
export { COLLEGE_META, CONTRACT_KIND_META, SEASON_LABEL, formatHours } from "@/modules/staffing/shared/rules";
export type { College, SeasonName } from "@/modules/staffing/shared/rules";
