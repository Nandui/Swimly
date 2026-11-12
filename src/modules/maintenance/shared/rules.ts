import { z } from "zod";
import { MOVES, OPEN_STATUSES, RISKS, TRACKPLAN_ANSWERS, URGENCIES, type MaintenanceStatus, type Move, type Risk, type TrackplanAnswer, type Urgency } from "./types";

/** Maintenance's rules, pure (tested in rules.test.ts). */

/** A problem a person can fix by changing what they entered; shown beside the form. */
export class MaintenanceError extends Error {}

const text = (max: number) => z.string().trim().max(max);
const fields = {
  area: text(120).default(""),
  place: text(200).default(""),
  title: text(160).min(3, "Say in a few words what is broken, such as ‘Shower 3 will not turn off’."),
  details: text(4000).default(""),
  urgency: z.enum(URGENCIES, { error: "Choose how urgent it is." }),
  risk: z.enum(RISKS, { error: "Say whether it is out of use or could hurt someone." }),
  trackplan: z.enum(TRACKPLAN_ANSWERS, { error: "Say whether it is already in Trackplan." }),
  trackplanRef: text(60).default(""),
};

/** A new report. `id` and `operationId` come from the form, so sending twice saves once. */
export const reportSchema = z.object({ id: z.uuid(), operationId: z.uuid(), siteId: z.string().min(1, "Choose a site."), ...fields });
export type ReportInput = z.input<typeof reportSchema>;

/** Manage correcting what was reported. The site stays: a request moves site by being reported again. */
export const correctSchema = z.object({ id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive(), ...fields });
export type CorrectInput = z.input<typeof correctSchema>;

export const moveSchema = z.object({
  id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive(), move: z.enum(MOVES),
  note: text(1000).default(""), trackplanRef: text(60).default(""), duplicateOfId: text(100).default(""),
});
export type MoveInput = z.input<typeof moveSchema>;

/** "Could hurt someone" is always urgent; otherwise the urgency chosen. */
export const urgencyFor = (risk: Risk, urgency: Urgency): Urgency => (risk === "could_hurt" ? "urgent" : urgency);

/** An open request is In Trackplan exactly when the answer is Yes; a closed one keeps its status. */
export function statusFor(status: MaintenanceStatus, trackplan: TrackplanAnswer): MaintenanceStatus {
  if (!isOpen(status)) return status;
  return trackplan === "yes" ? "in_trackplan" : "reported";
}
export const isOpen = (status: string): status is (typeof OPEN_STATUSES)[number] => (OPEN_STATUSES as readonly string[]).includes(status);

/** What a report or correction stores: urgency follows the risk, and a reference is kept only
 *  when the answer is Yes. */
export function cleanFields(input: { area: string; place: string; title: string; details: string; urgency: Urgency; risk: Risk; trackplan: TrackplanAnswer; trackplanRef: string }) {
  return { ...input, urgency: urgencyFor(input.risk, input.urgency), trackplanRef: input.trackplan === "yes" ? input.trackplanRef : "" };
}

type Row = { id: string; status: MaintenanceStatus; trackplan: TrackplanAnswer; trackplanRef: string };
type Who = { id: string; name: string };
/** The change one Manage move makes, or why it cannot be made. A duplicate must be another open
 *  or fixed request at the same site, checked by the caller, which passes it as `duplicate`. */
export function moveChange(row: Row, move: Move, input: { note: string; trackplanRef: string; duplicateOfId: string }, who: Who, now: Date, duplicate?: { id: string } | null) {
  const open = isOpen(row.status);
  const closing = { closedAt: now, closedById: who.id, closedByName: who.name };
  if (move === "trackplan") {
    if (row.status !== "reported") throw new MaintenanceError("Only a reported request can be put in Trackplan. Refresh to see where it is.");
    return { status: "in_trackplan" as const, trackplan: "yes" as const, trackplanRef: input.trackplanRef || row.trackplanRef };
  }
  if (move === "fix") {
    if (!open) throw new MaintenanceError("This request is already closed. Refresh to see where it is.");
    return { status: "fixed" as const, outcome: input.note, ...closing };
  }
  if (move === "close") {
    if (!open) throw new MaintenanceError("This request is already closed. Refresh to see where it is.");
    if (input.duplicateOfId) {
      if (input.duplicateOfId === row.id || !duplicate) throw new MaintenanceError("Choose the request this one repeats.");
      return { status: "closed" as const, duplicateOfId: duplicate.id, outcome: input.note || "Reported twice", ...closing };
    }
    if (input.note.length < 3) throw new MaintenanceError("Say why it is being closed without a fix.");
    return { status: "closed" as const, duplicateOfId: null, outcome: input.note, ...closing };
  }
  if (open) throw new MaintenanceError("This request is still open.");
  return { status: statusFor("reported", row.trackplan), outcome: "", duplicateOfId: null, closedAt: null, closedById: null, closedByName: null };
}

/** The first problem in what was sent, in the person's words. */
export function problemOf(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the details and try again.";
}
