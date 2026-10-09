/** Training's public API (CLAUDE.md section 6): the only file other modules,
 *  Core and front may import. Turnfin Me's staff API reads a person's own
 *  training through it. */
export { completeTrainingFor, myTraining, trainingReminderItems } from "@/modules/training/features/me";
