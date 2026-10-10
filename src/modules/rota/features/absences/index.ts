/** Reporting absences, extending them and recording returns to work. Entry for
 *  the module and its routes. */
export { BackAtWork, ExtendAbsence, RemoveAbsence, ReportAbsence, ReturnToWork } from "@/modules/rota/features/absences/components/absences";
export { returnsToWorkDue, type RotaAbsenceRow, rotaAbsences, type RotaReturnRow } from "@/modules/rota/features/absences/server/absences";
export { requireRotaActor } from "@/modules/rota/shared/access";
export { ABSENCE_REASON_META, RETURN_FIT_META } from "@/modules/rota/shared/constants";
