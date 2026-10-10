import assert from "node:assert/strict";
import { test } from "node:test";
import { LegendListError, parseLegendList, placesToConfirm } from "@/modules/activities/features/enrolment/server/legend-list";

/** A synthetic Legend export: invented member numbers only. */
const HEADER = ["Site Name", "Member Number", "Contact Reference", "Agreement Name"];

test("member numbers are read once each, in capitals, skipping totals", () => {
  assert.deepEqual(parseLegendList([
    HEADER,
    ["LeisureWorld Bishopstown", "lwb 900001", "1", "Aquatics"],
    ["LeisureWorld Churchfield", "LWC900002", "2", "Aquatics"],
    ["LeisureWorld Churchfield", "LWC900002", "2", "Aquatics"],
    ["998 rows found.", null, null, null],
  ]), ["LWB900001", "LWC900002"]);
});

test("a file without member numbers is refused", () => {
  assert.throws(() => parseLegendList([["Name", "Email"]]), LegendListError);
});

test("every outstanding place of a listed member is confirmed, at the sites allowed", () => {
  const places = [
    { id: "a", memberNumber: "LWB900001", siteId: "bish" },
    { id: "b", memberNumber: "lwb900001", siteId: "church" },
    { id: "c", memberNumber: "LWC900003", siteId: "church" },
    { id: "d", memberNumber: null, siteId: "bish" },
  ];
  assert.deepEqual(placesToConfirm(["LWB900001"], places, "all").map((p) => p.id), ["a", "b"]);
  assert.deepEqual(placesToConfirm(["LWB900001"], places, new Set(["bish"])).map((p) => p.id), ["a"]);
});
