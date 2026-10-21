import { z } from "zod";
import { isDateOnly, today } from "@/lib/format";
import { denominations, editableCoinage, type CoinageActor, type CoinageLines } from "./types";

export class CoinageError extends Error {}
/** A euro amount as whole cents, or null when empty. No floating point. */
export function money(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim())) throw new CoinageError("Enter each amount in euro with no more than two decimal places.");
  const [whole, decimal = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}
const text = (max: number) => z.string().trim().max(max);
const fieldsSchema = z.object({
  clubId: text(100).min(1, "Choose a site."), forWhom: text(200), notes: text(4000),
  neededBy: text(10).refine(v => !v || isDateOnly(v), "Choose a valid date for when it is needed."),
}).catchall(z.unknown());
/** The form's fields, with one euro amount per denomination (`line200` for €2 coins). Each amount
 *  must be a whole number of that coin. */
export function parseFields(input: unknown, submit: boolean, now = today()) {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) throw new CoinageError(parsed.error.issues[0].message);
  const { clubId, forWhom, notes, neededBy } = parsed.data;
  const lines: CoinageLines = {};
  let total = 0;
  for (const d of denominations) {
    const raw = parsed.data[`line${d.cents}`];
    const cents = money(typeof raw === "string" ? raw : "");
    if (!cents) continue;
    if (cents % d.cents) throw new CoinageError(`The amount of ${d.label} must be a whole number of them.`);
    lines[String(d.cents)] = cents; total += cents;
  }
  if (submit) {
    if (!forWhom || !neededBy || !total) throw new CoinageError("Add who it is for, when it is needed and at least one coin before sending.");
    if (neededBy < now) throw new CoinageError("Choose today or a later day for when it is needed.");
  }
  return { clubId, forWhom, notes, neededBy, lines, totalCents: total || null };
}
export const commandSchema = z.object({
  id: z.string().uuid(), operationId: z.string().uuid(), version: z.number().int().min(0),
  action: z.enum(["save", "submit", "claim", "information", "approve", "decline", "withdraw", "cancel", "order"]),
  fields: z.unknown().optional(), note: text(4000).default(""),
  orderedOn: text(10).default(""), deliveryOn: text(10).default(""), orderReference: text(200).default(""),
});
export type CoinageCommand = z.input<typeof commandSchema>;
type Row = { status: string; creatorId: string; totalCents: number | null };
export function transition(row: Row, who: CoinageActor, command: z.output<typeof commandSchema>, now = today()) {
  const { action, note } = command;
  const reviewable = row.status === "SUBMITTED" || row.status === "IN_REVIEW";
  if (action === "save" || action === "submit") {
    if (!editableCoinage(row, who)) throw new CoinageError("This request can no longer be changed. Refresh to see where it is.");
    return { status: action === "submit" ? "SUBMITTED" : row.status };
  }
  if (action === "claim") {
    if (!(reviewable && who.review) && !(row.status === "APPROVED" && who.process)) throw new CoinageError("You cannot take this on at this stage.");
    return { status: reviewable ? "IN_REVIEW" : row.status, handlerId: who.id, handlerName: who.name };
  }
  if (action === "approve" || action === "decline" || action === "information") {
    if (!who.review || !reviewable) throw new CoinageError("This request is not waiting for your decision. Refresh the page.");
    if (row.creatorId === who.id) throw new CoinageError("Another accounts colleague must decide your own request.");
    if (action !== "approve" && !note) throw new CoinageError("Enter a reason for this decision.");
    if (action === "approve") return { status: "APPROVED", approvedById: who.id, approvedByName: who.name, handlerId: who.id, handlerName: who.name };
    return { status: action === "decline" ? "DECLINED" : "NEEDS_INFORMATION", handlerId: who.id, handlerName: who.name };
  }
  if (action === "withdraw") {
    if (!who.request || !["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"].includes(row.status)) throw new CoinageError("Only a request that is not yet approved can be withdrawn.");
    if (!note) throw new CoinageError("Enter a reason for withdrawing the request.");
    return { status: "WITHDRAWN" };
  }
  if (action === "cancel") {
    if (!(who.review || who.process) || row.status !== "APPROVED") throw new CoinageError("Only an approval not yet ordered can be cancelled.");
    if (!note) throw new CoinageError("Enter a reason for cancelling the approval.");
    return { status: "WITHDRAWN" };
  }
  if (!who.process || row.status !== "APPROVED" || !row.totalCents) throw new CoinageError("Only an approved request can be recorded as ordered.");
  if (!isDateOnly(command.orderedOn) || command.orderedOn > now) throw new CoinageError("Choose the day it was ordered, today or earlier.");
  if (!isDateOnly(command.deliveryOn) || command.deliveryOn < command.orderedOn) throw new CoinageError("Choose a delivery day on or after the order day.");
  if (!command.orderReference) throw new CoinageError("Enter the order reference.");
  return { status: "ORDERED", orderedOn: command.orderedOn, deliveryOn: command.deliveryOn, orderReference: command.orderReference, orderedById: who.id, orderedByName: who.name };
}
