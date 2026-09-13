import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduleDate, scheduleHref, scheduleNow, scheduleWeek } from "./dates";
import { serverModule } from "@/test/server-module";

test("the week contains exactly Monday to Sunday across month, year and DST boundaries", () => {
  assert.deepEqual(scheduleWeek("2026-09-13"), ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"]);
  assert.deepEqual(scheduleWeek("2027-01-01"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  for (const sunday of ["2026-03-29", "2026-10-25"]) {
    const week = scheduleWeek(sunday);
    assert.equal(week.length, 7);
    assert.equal(new Set(week).size, 7);
    assert.equal(week[6], sunday);
  }
});

test("default dates follow Dublin while selected dates and safe links stay fixed", () => {
  const midnight = new Date("2026-09-13T23:30:00Z");
  for (const invalid of [undefined, "2026-02-30", "bad", ["2026-09-14"]]) assert.equal(scheduleDate(invalid, midnight), "2026-09-14");
  assert.equal(scheduleDate("2026-09-16", midnight), "2026-09-16");
  assert.equal(scheduleHref("2026-09-16"), "/schedule?date=2026-09-16");
  assert.equal(scheduleHref("https://example.test"), "/schedule");
  assert.equal(scheduleNow("2026-09-14", "2026-09-14", 930), 930);
  assert.equal(scheduleNow("2026-09-13", "2026-09-14", 930), 1440);
  assert.equal(scheduleNow("2026-09-15", "2026-09-14", 930), null);
});

test("old Today bookmarks redirect safely and retain a valid selected day", async () => {
  const page = serverModule<typeof import("@/app/(app)/today/page")>("src/app/(app)/today/page.tsx", {
    "next/navigation": { redirect: (href: string) => { throw new Error(href); } },
  }).default;
  await assert.rejects(page({ searchParams: Promise.resolve({ date: "2026-09-16" }) }), { message: "/schedule?date=2026-09-16" });
  await assert.rejects(page({ searchParams: Promise.resolve({ date: "2026-02-30" }) }), { message: "/schedule" });
});
