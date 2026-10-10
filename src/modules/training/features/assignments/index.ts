/** Assigning training to people, following it and cancelling it, and one
 *  person's training. Entry for the module and its routes. */
export { AssignTraining, CancelTraining } from "@/modules/training/features/assignments/components/manage-actions";
export { OVERVIEW_VIEWS, personTraining, trainingOverview } from "@/modules/training/features/assignments/server/data";
export { EXPIRY_WARNING_DAYS, TRAINING_STATUS_META } from "@/modules/training/shared/constants";
export { assignablePeople, listCourses } from "@/modules/training/shared/data";
