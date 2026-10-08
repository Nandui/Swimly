import assert from "node:assert/strict";
import { test } from "node:test";
import { requirementStates, requirementSummary } from "./requirements";

/** What a position needs, against what someone holds. Invented qualifications. */
const types = [{ id: "a", name: "First aid" }, { id: "b", name: "Lifeguard" }, { id: "c", name: "Safeguarding" }, { id: "d", name: "Pool plant" }];
const d = (s: string) => new Date(`${s}T00:00:00Z`);

test("each requirement takes the best record: a renewal counts, revoked and future ones do not", () => {
  const states = requirementStates(types, [
    { typeId: "a", issuedOn: d("2024-01-01"), expiresOn: d("2026-01-01"), revokedAt: null },
    { typeId: "a", issuedOn: d("2026-01-01"), expiresOn: d("2028-01-01"), revokedAt: null },
    { typeId: "b", issuedOn: d("2025-01-01"), expiresOn: d("2026-11-01"), revokedAt: null },
    { typeId: "c", issuedOn: d("2025-01-01"), expiresOn: null, revokedAt: d("2026-02-01") },
    { typeId: "d", issuedOn: d("2025-01-01"), expiresOn: d("2026-09-01"), revokedAt: null },
  ], "2026-10-08");
  assert.deepEqual(states.map((s) => [s.name, s.state]), [["Safeguarding", "missing"], ["Pool plant", "expired"], ["Lifeguard", "expiring"], ["First aid", "met"]]);
  assert.equal(states.find((s) => s.typeId === "a")?.expiresOn, "2028-01-01");
  assert.equal(requirementSummary(states), "1 not held, 1 expired, 1 expires soon");
});

test("a record that never expires is met; nothing required is nothing missing", () => {
  assert.equal(requirementStates([types[0]], [{ typeId: "a", issuedOn: d("2020-01-01"), expiresOn: null, revokedAt: null }], "2026-10-08")[0].state, "met");
  assert.deepEqual(requirementStates([], [], "2026-10-08"), []);
});
