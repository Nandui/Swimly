import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { coinageStatuses as frontDoorStatuses } from "@/modules/coinage";
import { commandSchema, transition, type CoinageCommand } from "./rules";
import { coinageActions, coinageListView, coinageNextActionKeys, coinageNextActions, coinageNextStep, coinageNumber, coinageStatuses, denominations, editableCoinage, euros, type CoinageActor } from "./types";

/** Coinage's pure rules, step by step: who may move a request from each status, what each move
 *  needs, and what the screen offers next. The workflow end to end is in __tests__/coinage.test.ts. */
const desk: CoinageActor = { id: "desk", name: "Alex Example", request: true, review: false, process: false };
const reviewer: CoinageActor = { id: "reviewer", name: "Riley Example", request: false, review: true, process: false };
const orderer: CoinageActor = { id: "orderer", name: "Jamie Example", request: false, review: false, process: true };
const accounts: CoinageActor = { ...reviewer, id: "accounts", process: true };
const STATUSES = Object.keys(coinageStatuses);
const NOW = "2026-10-21";
const row = (status: string, patch: Partial<{ creatorId: string; totalCents: number | null }> = {}) => ({ status, creatorId: desk.id, totalCents: 7250, ...patch });
const cmd = (action: CoinageCommand["action"], more: Partial<CoinageCommand> = {}) => commandSchema.parse({ id: randomUUID(), operationId: randomUUID(), version: 1, action, ...more });
const order = { orderedOn: "2026-10-20", deliveryOn: "2026-10-23", orderReference: "EXAMPLE-ORDER" };
/** The statuses from which `action` succeeds for `who`. */
const from = (who: CoinageActor, action: CoinageCommand["action"], more: Partial<CoinageCommand> = {}) =>
  STATUSES.filter((status) => { try { transition(row(status), who, cmd(action, more), NOW); return true; } catch { return false; } });

test("the front door's statuses are the rules' statuses, and every step a request can take has a label", () => {
  assert.equal(frontDoorStatuses, coinageStatuses);
  assert.deepEqual(Object.keys(coinageActions).sort(), [...commandSchema.shape.action.options].sort());
  for (const status of STATUSES) for (const who of [desk, accounts]) for (const action of commandSchema.shape.action.options) {
    try { assert.ok(Object.hasOwn(coinageStatuses, transition(row(status), who, cmd(action, { note: "Reason", ...order }), NOW).status)); } catch { /* refused is fine */ }
  }
  assert.deepEqual(denominations.map((d) => d.cents), [200, 100, 50, 20, 10, 5, 2, 1], "coins only, largest first");
});

test("the desk changes its own draft or one sent back with a question, and nothing later", () => {
  assert.deepEqual(from(desk, "save"), ["DRAFT", "NEEDS_INFORMATION"]);
  assert.deepEqual(from(desk, "submit"), ["DRAFT", "NEEDS_INFORMATION"]);
  assert.equal(transition(row("NEEDS_INFORMATION"), desk, cmd("submit"), NOW).status, "SUBMITTED");
  assert.throws(() => transition(row("DRAFT", { creatorId: "someone-else" }), desk, cmd("save"), NOW), /can no longer be changed/);
  assert.equal(editableCoinage(row("NEEDS_INFORMATION", { creatorId: "someone-else" }), desk), true, "anyone at the desk can answer accounts");
  assert.deepEqual(from(accounts, "save"), [], "accounts never edits the request");
});

test("accounts takes a request on while deciding, and the orderer once it is approved", () => {
  assert.deepEqual(from(reviewer, "claim"), ["SUBMITTED", "IN_REVIEW"]);
  assert.deepEqual(from(orderer, "claim"), ["APPROVED"]);
  assert.deepEqual(from(desk, "claim"), []);
  assert.equal(transition(row("APPROVED"), orderer, cmd("claim"), NOW).status, "APPROVED");
});

test("deciding: only while waiting, never your own, and a reason to decline or ask", () => {
  for (const action of ["approve", "decline", "information"] as const) assert.deepEqual(from(reviewer, action, { note: "Reason" }), ["SUBMITTED", "IN_REVIEW"], action);
  assert.deepEqual(from(orderer, "approve"), [], "ordering is not deciding");
  assert.throws(() => transition(row("SUBMITTED", { creatorId: reviewer.id }), reviewer, cmd("approve"), NOW), /Another accounts colleague/);
  assert.throws(() => transition(row("SUBMITTED"), reviewer, cmd("information"), NOW), /reason/);
  assert.deepEqual(transition(row("SUBMITTED"), reviewer, cmd("approve"), NOW),
    { status: "APPROVED", approvedById: reviewer.id, approvedByName: reviewer.name, handlerId: reviewer.id, handlerName: reviewer.name });
  assert.equal(transition(row("IN_REVIEW"), reviewer, cmd("decline", { note: "Order through the bank" }), NOW).status, "DECLINED");
});

test("the desk withdraws before approval, accounts cancels an approval not yet ordered, and both say why", () => {
  assert.deepEqual(from(desk, "withdraw", { note: "Not needed" }), ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"]);
  assert.throws(() => transition(row("DRAFT"), desk, cmd("withdraw"), NOW), /reason/);
  assert.deepEqual(from(reviewer, "cancel", { note: "Ordered by phone" }), ["APPROVED"]);
  assert.deepEqual(from(orderer, "cancel", { note: "Ordered by phone" }), ["APPROVED"]);
  assert.deepEqual(from(desk, "cancel", { note: "x" }), []);
  assert.throws(() => transition(row("APPROVED"), orderer, cmd("cancel"), NOW), /reason/);
});

test("an order is recorded once approved: ordered today or earlier, delivered on or after, with a reference", () => {
  assert.deepEqual(from(orderer, "order", order), ["APPROVED"]);
  assert.deepEqual(from(reviewer, "order", order), [], "deciding is not ordering");
  assert.throws(() => transition(row("APPROVED", { totalCents: null }), orderer, cmd("order", order), NOW), /approved request/, "no coins, nothing to order");
  assert.throws(() => transition(row("APPROVED"), orderer, cmd("order", { ...order, orderedOn: "2026-10-22" }), NOW), /today or earlier/);
  assert.throws(() => transition(row("APPROVED"), orderer, cmd("order", { ...order, orderedOn: "" }), NOW), /today or earlier/);
  assert.throws(() => transition(row("APPROVED"), orderer, cmd("order", { ...order, deliveryOn: "2026-10-19" }), NOW), /on or after/);
  assert.throws(() => transition(row("APPROVED"), orderer, cmd("order", { ...order, orderReference: "" }), NOW), /reference/);
  assert.equal(transition(row("APPROVED"), orderer, cmd("order", { ...order, orderedOn: NOW, deliveryOn: NOW }), NOW).status, "ORDERED", "ordered and delivered today is allowed");
  assert.deepEqual(transition(row("APPROVED"), orderer, cmd("order", order), NOW), { status: "ORDERED", ...order, orderedById: orderer.id, orderedByName: orderer.name });
});

test("the screen offers each person only the steps the rules allow, in order", () => {
  const offer = (status: string, who: CoinageActor, patch: { creatorId?: string; handlerId?: string | null } = {}) => coinageNextActions({ status, creatorId: desk.id, handlerId: null, ...patch }, who);
  assert.deepEqual(offer("SUBMITTED", reviewer), ["claim", "approve", "information", "decline"]);
  assert.deepEqual(offer("IN_REVIEW", reviewer, { handlerId: reviewer.id }), ["approve", "information", "decline"]);
  assert.deepEqual(offer("SUBMITTED", { ...reviewer, request: true }, { creatorId: reviewer.id }), ["claim", "withdraw"], "never a decision on your own request");
  assert.deepEqual(offer("APPROVED", orderer), ["claim", "order", "cancel"]);
  assert.deepEqual(offer("APPROVED", reviewer), ["cancel"]);
  for (const status of ["ORDERED", "DECLINED", "WITHDRAWN"]) assert.deepEqual(offer(status, { ...accounts, request: true }), [], `${status} is closed`);
  for (const status of STATUSES) for (const who of [desk, reviewer, orderer, accounts]) {
    const offered = offer(status, who);
    assert.deepEqual(offered, coinageNextActionKeys.filter((key) => offered.includes(key)), "in the order shown");
    for (const action of offered) assert.doesNotThrow(() => transition(row(status), who, cmd(action, { note: "Reason", ...order }), NOW), `${action} offered at ${status}`);
  }
});

test("each status says whose move it is; the list address picks the view; numbers and amounts read as staff expect", () => {
  assert.match(coinageNextStep("DRAFT"), /send it to accounts/);
  assert.match(coinageNextStep("NEEDS_INFORMATION"), /The desk/);
  assert.match(coinageNextStep("SUBMITTED"), /check the request and decide/);
  assert.equal(coinageNextStep("IN_REVIEW"), coinageNextStep("SUBMITTED"));
  assert.match(coinageNextStep("APPROVED"), /order the coinage/);
  assert.match(coinageNextStep("ORDERED"), /when it arrives/);
  for (const status of ["DECLINED", "WITHDRAWN"]) assert.match(coinageNextStep(status), /closed/);
  const params = (q: string) => new URLSearchParams(q);
  assert.equal(coinageListView(params("status=DRAFT"), "desk"), "drafts");
  assert.equal(coinageListView(params("creator=desk"), "desk"), "mine");
  assert.equal(coinageListView(params("creator=someone-else"), "desk"), "requests");
  assert.equal(coinageNumber(42), "CO-000042");
  assert.equal(euros(null), "Not entered");
  assert.equal(euros(7250), "€72.50");
});
