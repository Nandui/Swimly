import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

/** The working site: the picked site when the person may work there, else their Main site,
 *  else the first of their Works at sites, else the first live site. */
const { pickClub } = serverModule<typeof import("./current")>("src/lib/clubs/current.ts", {
  "next/headers": { cookies: async () => ({ get: () => undefined }) },
  "@/lib/prisma": { prisma: {} },
  "@/lib/operations/context": { operationContext: { getStore: () => undefined } },
});

const live = [{ id: "a" }, { id: "b" }, { id: "c" }];
const pick = (wanted: string | undefined, own: { primary: string | null; sites: string[] } | null) => pickClub(live, wanted, own).club.id;

test("the picked site wins when the person may work there", () => {
  assert.equal(pick("c", { primary: "b", sites: [] }), "c");
  assert.equal(pick("c", { primary: "b", sites: ["b", "c"] }), "c");
});

test("with nothing picked, the person's Main site", () => {
  assert.equal(pick(undefined, { primary: "b", sites: [] }), "b", "every site, Main site b");
  assert.equal(pick(undefined, { primary: "c", sites: ["b", "c"] }), "c");
});

test("a Main site outside their Works at list gives the first of that list", () => {
  assert.equal(pick(undefined, { primary: "a", sites: ["c", "b"] }), "c");
  assert.equal(pick(undefined, { primary: null, sites: ["b"] }), "b");
});

test("nobody signed in, or no Main site, gives the first live site", () => {
  assert.equal(pick(undefined, null), "a");
  assert.equal(pick(undefined, { primary: null, sites: [] }), "a");
});

test("a stale or foreign cookie falls back instead of opening a site they do not work at", () => {
  assert.equal(pick("gone", { primary: "b", sites: [] }), "b");
  assert.equal(pick("a", { primary: "c", sites: ["c"] }), "c");
  const theirs = pickClub(live, "a", { primary: "c", sites: ["b", "c"] });
  assert.deepEqual(theirs.clubs.map((c) => c.id), ["b", "c"], "the picker lists only their sites");
});
