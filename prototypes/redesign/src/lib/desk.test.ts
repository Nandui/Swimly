import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDeskCommand } from "./desk";
import { initialDesk } from "./fixtures";

test("an enrolment succeeds without mutating the supplied state and records activity", () => {
  const before = initialDesk();
  const result = applyDeskCommand(
    before,
    {
      type: "enrol",
      swimmerId: "bishopstown-1",
      classId: "bishopstown-turtles-later",
    },
    "bishopstown",
    true,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(
      result.data.classes
        .find((course) => course.id === "bishopstown-turtles-later")
        ?.swimmerIds.includes("bishopstown-1"),
    );
    assert.equal(result.data.activity.length, 1);
  }
  assert.equal(
    before.classes.find((course) => course.id === "bishopstown-turtles-later")
      ?.swimmerIds.length,
    0,
  );
});
test("failed moves preserve the original place, including full and mismatched-level targets", () => {
  const before = initialDesk();
  for (const classId of ["bishopstown-sharks", "bishopstown-dolphins"]) {
    const result = applyDeskCommand(
      before,
      {
        type: "move",
        swimmerId: "bishopstown-1",
        fromClassId: "bishopstown-turtles",
        classId,
      },
      "bishopstown",
      true,
    );
    assert.equal(result.ok, false);
    assert.ok(before.classes[0].swimmerIds.includes("bishopstown-1"));
  }
});
test("successful move removes exactly one original place and adds the new one", () => {
  const result = applyDeskCommand(
    initialDesk(),
    {
      type: "move",
      swimmerId: "bishopstown-1",
      fromClassId: "bishopstown-turtles",
      classId: "bishopstown-turtles-later",
    },
    "bishopstown",
    true,
  );
  assert.ok(result.ok);
  assert.equal(
    result.data.classes[0].swimmerIds.includes("bishopstown-1"),
    false,
  );
  assert.ok(
    result.data.classes
      .find((course) => course.id === "bishopstown-turtles-later")
      ?.swimmerIds.includes("bishopstown-1"),
  );
});
test("permissions, inactive swimmers and club isolation are enforced in the adapter", () => {
  const command = {
    type: "enrol" as const,
    swimmerId: "bishopstown-1",
    classId: "bishopstown-turtles-later",
  };
  assert.equal(
    applyDeskCommand(initialDesk(), command, "bishopstown", false).ok,
    false,
  );
  assert.equal(
    applyDeskCommand(initialDesk(), command, "churchfield", true).ok,
    false,
  );
  assert.equal(
    applyDeskCommand(
      initialDesk(),
      { ...command, swimmerId: "bishopstown-12" },
      "bishopstown",
      true,
    ).ok,
    false,
  );
});
test("assessment bookings detect duplicate and full sessions", () => {
  const command = {
    type: "assessment" as const,
    swimmerId: "bishopstown-1",
    sessionId: "bishopstown-assessment-2",
  };
  const first = applyDeskCommand(initialDesk(), command, "bishopstown", true);
  assert.ok(first.ok);
  assert.equal(
    applyDeskCommand(first.data, command, "bishopstown", true).ok,
    false,
  );
  const second = applyDeskCommand(
    first.data,
    { ...command, swimmerId: "bishopstown-2" },
    "bishopstown",
    true,
  );
  assert.ok(second.ok);
  assert.equal(
    applyDeskCommand(
      second.data,
      { ...command, swimmerId: "bishopstown-3" },
      "bishopstown",
      true,
    ).ok,
    false,
  );
});
