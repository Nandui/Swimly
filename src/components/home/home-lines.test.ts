import assert from "node:assert/strict";
import { test } from "node:test";
import type { HomeItem, HomeSession } from "@/modules/contributions";
import { greetingAt, homeLines } from "./home-lines";

/** What Home shows from the apps' items: places to cover first, then queues that need the person;
 *  today's figures; New; and what starts next. Invented classes and queues. */
const session = (label: string, start: number, state: HomeSession["state"]): HomeSession => ({ label, area: "Learner Pool", start, end: start + 30, state, href: `/courses/${label}` });
const modules = [{ id: "swim-school" }, { id: "refunds" }, { id: "rota" }];
const items = new Map<string, HomeItem[]>([
  ["swim-school", [
    { kind: "action", label: "Add a swimmer", href: "/students?add=1", icon: "userPlus" },
    { kind: "today", label: "Classes", count: 9, href: "/schedule" },
    { kind: "timeline", label: "Classes today", href: "/schedule", sessions: [
      session("Starfish", 960, "done"), session("Sharks", 1020, "now"), session("Penguins", 1080, "cover"),
      session("Seahorses", 1050, "cover"), session("Otters", 1110, "off"), session("Eels", 1140, "next"),
      session("Rays", 1170, "next"), session("Pike", 1200, "next"), session("Carp", 1230, "next"),
    ] },
    { label: "Awaiting enrolment", count: 6, href: "/awaiting-enrolment", attention: true },
    { label: "Parent updates", count: 0, href: "/students/parent-changes", attention: false },
  ]],
  ["refunds", [{ label: "Refund requests to decide", count: 4, href: "/refunds?status=review", attention: true }]],
  ["rota", [{ kind: "today", label: "On the rota at Example site", count: 11, href: "/rota/today", attention: true, hint: "2 gaps to fill" }]],
]);

test("places to cover come first, soonest first, and only those not yet over", () => {
  const lines = homeLines(modules, items, 1040);
  assert.deepEqual(lines.toCover.map((s) => s.label), ["Seahorses", "Penguins"]);
  assert.deepEqual(homeLines(modules, items, 1085).toCover.map((s) => s.label), ["Penguins"], "Seahorses ended at 17:50");
  assert.deepEqual(homeLines(modules, items, 1200).toCover, [], "every place is in the past");
});

test("Needs you lists only the queues that wait for the person, in the apps' order", () => {
  const { queues } = homeLines(modules, items, 1040);
  assert.deepEqual(queues.map(({ item }) => item.label), ["Awaiting enrolment", "Refund requests to decide"]);
  assert.ok(queues.every(({ item }) => !item.kind), "a figure that needs them stays a figure");
});

test("Right now has today's figures, New has every quick action, and the timetable link is the timeline's", () => {
  const lines = homeLines(modules, items, 1040);
  assert.deepEqual(lines.figures.map(({ item }) => item.label), ["Classes", "On the rota at Example site"]);
  assert.deepEqual(lines.actions.map((a) => [a.label, a.href, a.icon]), [["Add a swimmer", "/students?add=1", "userPlus"]]);
  assert.equal(lines.timelineHref, "/schedule");
  assert.equal(lines.sessions.length, 9);
});

test("Up next is the next four that have not started, cancelled ones left out", () => {
  assert.deepEqual(homeLines(modules, items, 1040).upNext.map((s) => s.label), ["Seahorses", "Penguins", "Eels", "Rays"]);
  assert.deepEqual(homeLines(modules, items, 1235).upNext, [], "nothing left today");
});

test("an app with nothing for the person adds nothing, and the greeting follows the clock", () => {
  const empty = homeLines([{ id: "stock" }], new Map(), 600);
  assert.deepEqual([empty.sessions, empty.toCover, empty.queues, empty.figures, empty.actions, empty.upNext, empty.timelineHref], [[], [], [], [], [], [], null]);
  assert.deepEqual([greetingAt(0), greetingAt(719), greetingAt(720), greetingAt(1079), greetingAt(1080)], ["Good morning", "Good morning", "Good afternoon", "Good afternoon", "Good evening"]);
});
