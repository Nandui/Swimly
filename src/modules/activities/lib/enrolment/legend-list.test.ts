import assert from "node:assert/strict";
import { test } from "node:test";
import { agreementFits, LegendListError, parseLegendList, planLegendMatch, type Place } from "./legend-list";

/** A synthetic Legend export: invented member numbers only. */
const HEADER = ["Site Name", "Member Number", "Contact Reference", "Termination Date", "Agreement Name", "Agreement Price Name"];
const TODAY = "2026-09-29";

test("members are read once each; a terminated agreement counts only when nothing else is live", () => {
  const members = parseLegendList([
    HEADER,
    ["LeisureWorld Bishopstown", "lwb 900001", "1", null, "Aquatics", "Water Safety & Fun"],
    ["LeisureWorld Churchfield", "LWC900002", "2", new Date("2026-09-20T00:00:00Z"), "Aquatics", "Swimming Skills"],
    ["LeisureWorld Churchfield", "LWC900003", "3", new Date("2026-09-20T00:00:00Z"), "Aquatics", "Lifesaving"],
    ["LeisureWorld Churchfield", "LWC900003", "3", null, "Aquatics", "Lifesaving"],
    ["LeisureWorld Bishopstown", "LWB900004", "4", new Date("2026-12-31T00:00:00Z"), "Aquatics", "Water Safety & Fun"],
    ["998 rows found.", null, null, null, null, null],
  ], TODAY);
  assert.deepEqual(members.map((m) => [m.memberNumber, m.terminated]), [["LWB900001", false], ["LWC900002", true], ["LWC900003", false], ["LWB900004", false]]);
});

test("a file without member numbers is refused", () => {
  assert.throws(() => parseLegendList([["Name", "Email"]], TODAY), LegendListError);
});

test("the agreement fits the place's programme, or a level it names", () => {
  assert.equal(agreementFits("Water Safety & Fun", { programmeName: "Water Safety and Fun", levelName: "Starfish" }), true);
  assert.equal(agreementFits("Lifesaving", { programmeName: "RLSS Lifesaving", levelName: "Rookies Bronze" }), true);
  assert.equal(agreementFits("Otters", { programmeName: "Learn to swim", levelName: "Otters" }), true);
  assert.equal(agreementFits("Swimming Skills", { programmeName: "Water Safety & Fun", levelName: "Penguins" }), false);
});

test("only this site's outstanding places are confirmed; the rest are explained", () => {
  const place = (id: string, memberNumber: string | null, siteId: string, programmeName = "Water Safety & Fun"): Place => ({ id, memberNumber, siteId, programmeName, levelName: "Starfish" });
  const outstanding = [
    place("a", "LWB900001", "bish"),
    place("b", "LWB900001", "bish", "Swimming Skills"),
    place("c", "LWC900002", "bish"),
    place("d", "LWC900005", "church"),
    place("e", "LWB900009", "bish"),
    place("f", null, "bish"),
  ];
  const plan = planLegendMatch([
    { memberNumber: "LWB900001", priceName: "Water Safety & Fun", terminated: false },
    { memberNumber: "LWC900002", priceName: "Water Safety & Fun", terminated: true },
    { memberNumber: "LWC900005", priceName: "Water Safety & Fun", terminated: false },
    { memberNumber: "LWB900006", priceName: "Water Safety & Fun", terminated: false },
    { memberNumber: "LWB900007", priceName: "Water Safety & Fun", terminated: false },
  ], outstanding, "bish", new Set(["LWB900001", "LWC900002", "LWC900005", "LWB900006", "LWB900009"]));
  assert.deepEqual(plan.confirm.map((p) => p.id), ["a"]);
  assert.deepEqual(plan.mismatch.map((p) => [p.id, p.priceName]), [["b", "Water Safety & Fun"]]);
  assert.deepEqual(plan.terminated.map((p) => p.id), ["c"]);
  assert.equal(plan.otherSite, 1);
  assert.equal(plan.alreadyConfirmed, 1);
  assert.deepEqual(plan.notFound, ["LWB900007"]);
});
