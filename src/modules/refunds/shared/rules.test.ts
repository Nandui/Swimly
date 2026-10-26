import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { today } from "@/lib/format";
import { refundStatuses as frontDoorStatuses } from "@/modules/refunds";
import { commandSchema, transition, type RefundCommand } from "./rules";
import { editableRefund, euros, refundActions, refundListView, refundNextActions, refundNextStep, refundNumber, refundStatuses, type RefundActor } from "./types";

/** Refunds' pure rules, step by step: who may move a request from each status, what each move
 *  needs, and what the screen offers next. The workflow end to end is in __tests__/refunds.test.ts. */
const desk: RefundActor = { id: "desk", name: "Alex Example", request: true, review: false, process: false };
const reviewer: RefundActor = { id: "reviewer", name: "Riley Example", request: false, review: true, process: false };
const payer: RefundActor = { id: "payer", name: "Jamie Example", request: false, review: false, process: true };
const finance: RefundActor = { ...reviewer, id: "finance", process: true };
const STATUSES = Object.keys(refundStatuses);
const row = (status: string, patch: Partial<{ creatorId: string; requestedCents: number | null; approvedCents: number | null; paymentDate: string }> = {}) =>
  ({ status, creatorId: desk.id, requestedCents: 8000, approvedCents: status === "APPROVED" ? 8000 : null, paymentDate: "2026-01-01", ...patch });
const cmd = (action: RefundCommand["action"], more: Partial<RefundCommand> = {}) => commandSchema.parse({ id: randomUUID(), operationId: randomUUID(), version: 1, action, ...more });
const pay = { paidOn: "2026-01-02", paidMethod: "CARD", paidReference: "EXAMPLE-REFUND" };
/** The statuses from which `action` succeeds for `who`. */
const from = (who: RefundActor, action: RefundCommand["action"], more: Partial<RefundCommand> = {}) =>
  STATUSES.filter((status) => { try { transition(row(status), who, cmd(action, more)); return true; } catch { return false; } });

test("the front door's statuses are the rules' statuses, and every step a request can take has a label", () => {
  assert.equal(frontDoorStatuses, refundStatuses);
  for (const action of commandSchema.shape.action.options) assert.ok(refundActions[action], `${action} is named in the history`);
  for (const status of STATUSES) for (const who of [desk, finance]) for (const action of commandSchema.shape.action.options) {
    try { assert.ok(Object.hasOwn(refundStatuses, transition(row(status), who, cmd(action, { note: "Reason", amount: "80", ...pay })).status)); } catch { /* refused is fine */ }
  }
});

test("reception edits its own draft or one sent back for information, and nothing later", () => {
  assert.deepEqual(from(desk, "save"), ["DRAFT", "NEEDS_INFORMATION"]);
  assert.deepEqual(from(desk, "submit"), ["DRAFT", "NEEDS_INFORMATION"]);
  assert.equal(transition(row("DRAFT"), desk, cmd("save")).status, "DRAFT", "saving keeps a draft a draft");
  assert.equal(transition(row("NEEDS_INFORMATION"), desk, cmd("submit")).status, "SUBMITTED");
  assert.throws(() => transition(row("DRAFT", { creatorId: "someone-else" }), desk, cmd("save")), /no longer be edited/, "another person's draft is theirs");
  assert.equal(editableRefund(row("NEEDS_INFORMATION", { creatorId: "someone-else" }), desk), true, "anyone at the desk can answer finance's question");
  assert.deepEqual(from(finance, "save"), [], "finance never edits the request");
});

test("finance takes a request on while it is being decided, and the payer once it is approved", () => {
  assert.deepEqual(from(reviewer, "claim"), ["SUBMITTED", "IN_REVIEW"]);
  assert.deepEqual(from(payer, "claim"), ["APPROVED"]);
  assert.deepEqual(from(desk, "claim"), []);
  assert.deepEqual(transition(row("SUBMITTED"), reviewer, cmd("claim")), { status: "IN_REVIEW", handlerId: reviewer.id, handlerName: reviewer.name });
  assert.equal(transition(row("APPROVED"), payer, cmd("claim")).status, "APPROVED", "taking on a payment does not change where it is");
});

test("deciding: only while waiting, never your own, a reason to decline or ask, and never more than was asked for", () => {
  for (const action of ["approve", "decline", "information"] as const) assert.deepEqual(from(reviewer, action, { note: "Reason", amount: "80" }), ["SUBMITTED", "IN_REVIEW"], action);
  assert.deepEqual(from(payer, "approve", { amount: "80" }), [], "paying is not deciding");
  assert.throws(() => transition(row("SUBMITTED", { creatorId: reviewer.id }), reviewer, cmd("approve", { amount: "80" })), /Another finance colleague/);
  assert.throws(() => transition(row("SUBMITTED"), reviewer, cmd("decline")), /reason/);
  assert.throws(() => transition(row("SUBMITTED"), reviewer, cmd("information")), /reason/);
  assert.equal(transition(row("SUBMITTED"), reviewer, cmd("information", { note: "Which month?" })).status, "NEEDS_INFORMATION");
  assert.equal(transition(row("IN_REVIEW"), reviewer, cmd("decline", { note: "Outside the terms" })).status, "DECLINED");
  assert.throws(() => transition(row("SUBMITTED"), reviewer, cmd("approve", { amount: "80.01" })), /no higher/);
  assert.throws(() => transition(row("SUBMITTED"), reviewer, cmd("approve", { amount: "" })), /greater than zero/);
  assert.throws(() => transition(row("SUBMITTED", { requestedCents: null }), reviewer, cmd("approve", { amount: "80" })), /greater than zero/, "nothing asked for, nothing to approve");
  assert.throws(() => transition(row("SUBMITTED"), reviewer, cmd("approve", { amount: "50" })), /Explain why/);
  assert.deepEqual(transition(row("SUBMITTED"), reviewer, cmd("approve", { amount: "50", note: "Part used" })),
    { status: "APPROVED", approvedCents: 5000, approvedById: reviewer.id, approvedByName: reviewer.name, handlerId: reviewer.id, handlerName: reviewer.name });
});

test("reception withdraws before approval, finance cancels an unpaid approval, and both say why", () => {
  assert.deepEqual(from(desk, "withdraw", { note: "Customer changed their mind" }), ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"]);
  assert.throws(() => transition(row("SUBMITTED"), desk, cmd("withdraw")), /reason/);
  assert.deepEqual(from(finance, "withdraw", { note: "x" }), [], "finance cancels, it does not withdraw");
  assert.deepEqual(from(reviewer, "cancel", { note: "Paid by phone" }), ["APPROVED"]);
  assert.deepEqual(from(payer, "cancel", { note: "Paid by phone" }), ["APPROVED"]);
  assert.deepEqual(from(desk, "cancel", { note: "x" }), []);
  assert.throws(() => transition(row("APPROVED"), payer, cmd("cancel")), /reason/);
  assert.equal(transition(row("APPROVED"), payer, cmd("cancel", { note: "Paid by phone" })).status, "WITHDRAWN");
});

test("a payment is recorded once approved: dated between the original payment and today, with a known method and a reference", () => {
  assert.deepEqual(from(payer, "pay", pay), ["APPROVED"]);
  assert.deepEqual(from(reviewer, "pay", pay), [], "deciding is not paying");
  assert.throws(() => transition(row("APPROVED", { approvedCents: null }), payer, cmd("pay", pay)), /approved, unpaid/);
  assert.throws(() => transition(row("APPROVED"), payer, cmd("pay", { ...pay, paidOn: "2025-12-31" })), /between the original payment and today/, "before the customer paid");
  const tomorrow = new Date(Date.parse(`${today()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  assert.throws(() => transition(row("APPROVED"), payer, cmd("pay", { ...pay, paidOn: tomorrow })), /between/, "in the future");
  assert.throws(() => transition(row("APPROVED"), payer, cmd("pay", { ...pay, paidMethod: "CHEQUE" })), /method and reference/);
  assert.throws(() => transition(row("APPROVED"), payer, cmd("pay", { ...pay, paidReference: "" })), /method and reference/);
  assert.deepEqual(transition(row("APPROVED"), payer, cmd("pay", pay)), { status: "REFUNDED", ...pay, paidById: payer.id, paidByName: payer.name });
  assert.equal(transition(row("APPROVED", { paymentDate: "2026-01-02" }), payer, cmd("pay", pay)).status, "REFUNDED", "the same day as the payment is allowed");
});

test("the screen offers each person only the steps the rules allow, in order", () => {
  const offer = (status: string, who: RefundActor, patch: { creatorId?: string; handlerId?: string | null } = {}) => refundNextActions({ status, creatorId: desk.id, handlerId: null, ...patch }, who);
  assert.deepEqual(offer("SUBMITTED", reviewer), ["claim", "approve", "information", "decline"]);
  assert.deepEqual(offer("IN_REVIEW", reviewer, { handlerId: reviewer.id }), ["approve", "information", "decline"], "already theirs, nothing to take on");
  assert.deepEqual(offer("SUBMITTED", { ...reviewer, request: true }, { creatorId: reviewer.id }), ["claim", "withdraw"], "never a decision on your own request");
  assert.deepEqual(offer("APPROVED", payer), ["claim", "pay", "cancel"]);
  assert.deepEqual(offer("APPROVED", reviewer), ["cancel"]);
  assert.deepEqual(offer("NEEDS_INFORMATION", desk), ["withdraw"]);
  for (const status of ["REFUNDED", "DECLINED", "WITHDRAWN"]) assert.deepEqual(offer(status, { ...finance, request: true }), [], `${status} is closed`);
  // Everything offered is something the rules accept.
  for (const status of STATUSES) for (const who of [desk, reviewer, payer, finance]) for (const action of offer(status, who))
    assert.doesNotThrow(() => transition(row(status), who, cmd(action, { note: "Reason", amount: "80", ...pay })), `${action} offered at ${status}`);
});

test("each status says whose move it is; the list address picks the view; numbers and amounts read as staff expect", () => {
  assert.match(refundNextStep("DRAFT"), /submit to finance/);
  assert.match(refundNextStep("NEEDS_INFORMATION"), /Reception/);
  assert.match(refundNextStep("SUBMITTED"), /Finance needs to review/);
  assert.equal(refundNextStep("IN_REVIEW"), refundNextStep("SUBMITTED"));
  assert.match(refundNextStep("APPROVED"), /issue the refund/);
  for (const status of ["REFUNDED", "DECLINED", "WITHDRAWN"]) assert.match(refundNextStep(status), /closed/);
  const params = (q: string) => new URLSearchParams(q);
  assert.equal(refundListView(params("status=DRAFT&creator=desk"), "desk"), "drafts");
  assert.equal(refundListView(params("creator=desk"), "desk"), "mine");
  assert.equal(refundListView(params("creator=someone-else"), "desk"), "requests");
  assert.equal(refundListView(params(""), "desk"), "requests");
  assert.equal(refundNumber(42), "RF-000042");
  assert.equal(euros(null), "Not entered");
  assert.equal(euros(8050), "€80.50");
});
