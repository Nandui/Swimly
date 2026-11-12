import assert from "node:assert/strict";
import { test } from "node:test";
import { readWhatIf, togetherHref } from "@/modules/activities/features/together/href";

test("the address keeps the group's order and only its what-ifs", () => {
  assert.equal(togetherHref([]), "/together");
  assert.equal(togetherHref(["a", "b"]), "/together?students=a,b");
  assert.equal(togetherHref(["a", "b"], { b: "seals", gone: "x" }), "/together?students=a,b&as=b:seals");
});

test("a what-if is read only for swimmers in the group at levels that exist", () => {
  assert.deepEqual(readWhatIf("a:seals,b:nope,c:seals,bad", ["a", "b"], new Set(["seals"])), { a: "seals" });
  assert.deepEqual(readWhatIf("", ["a"], new Set(["seals"])), {});
});
