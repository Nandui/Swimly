/** Classroom and poolside sessions: places, a register and attendance that
 *  completes a course and counts in-service hours (e-learning phase 5). Entry
 *  for the module and its routes. */
export { AddToSession, CancelSession, CloseRegister, MarkEveryoneAttended, RegisterToggle, RemoveFromSession, SessionDialog } from "@/modules/training/features/sessions/components/sessions";
export { listSessions, registersToClose, sessionDetail, type SessionRow } from "@/modules/training/features/sessions/server/data";
export { sessionsOf } from "@/modules/training/shared/on-the-job-reads";
export { PLACE_STATUS_META, SESSION_STATUS_META } from "@/modules/training/shared/constants";
