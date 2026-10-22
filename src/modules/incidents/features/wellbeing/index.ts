/** Asking HR from a report, by email: to check on someone's wellbeing after an
 *  incident, or to let HR know a staff member was in one (the feature keeps its
 *  first name). HR's link page where they record what they did, and who gets
 *  the requests (Incidents > Settings). Entry for the module and its routes. */
export { WellbeingPanel } from "@/modules/incidents/features/wellbeing/components/wellbeing-panel";
export { RecordWellbeing, WellbeingLinkClosed } from "@/modules/incidents/features/wellbeing/components/record-wellbeing";
export { WellbeingSettings } from "@/modules/incidents/features/wellbeing/components/wellbeing-settings";
export { wellbeingOnReport } from "@/modules/incidents/features/wellbeing/server/requests";
export { wellbeingLink } from "@/modules/incidents/features/wellbeing/server/hr-link";
export { wellbeingSetting } from "@/modules/incidents/features/wellbeing/server/settings";
