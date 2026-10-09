import assert from "node:assert/strict";
import { test } from "node:test";
import { emit, on } from "./index";

declare module "./index" {
  interface PlatformEvents {
    "test.thing.happened": { id: string };
  }
}

test("every listener hears the event, and a failing one breaks neither the emitter nor the others", async () => {
  const heard: string[] = [];
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  const stopFirst = on("test.thing.happened", () => { throw new Error("listener broke"); });
  const stopSecond = on("test.thing.happened", async ({ id }) => { heard.push(id); });
  try {
    await emit("test.thing.happened", { id: "a" });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(heard, ["a"]);
  assert.equal(errors.length, 1, "the failure is logged");
  stopFirst();
  stopSecond();
  await emit("test.thing.happened", { id: "b" });
  assert.deepEqual(heard, ["a"], "a stopped listener hears nothing");
});
