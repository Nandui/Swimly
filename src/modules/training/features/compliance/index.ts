/** Compliance autopilot (docs/training.md, e-learning phase 4): training rules that assign
 *  courses by role, department, site and position and again when they are due, the training
 *  matrix, and checking a certificate. Entry for the module and its routes. */
export { trainingRules, trainingMatrix, type MatrixFilters } from "@/modules/training/features/compliance/server/data";
export { checkCertificate } from "@/modules/training/features/compliance/server/certificate";
export { PauseRule, RemoveRule, RuleDialog, RunRulesNow } from "@/modules/training/features/compliance/components/rules";
export { MATRIX_CELL_META, RULE_STATE_META } from "@/modules/training/shared/constants";
export { cellInWords, cellTone, csvRows, type MatrixCell } from "@/modules/training/shared/rules";
export { applyTrainingRules } from "@/modules/training/features/compliance/server/engine";
