import assert from "node:assert/strict";
import { test } from "node:test";
import { swimmerDirectoryHref, swimmerFilters, swimmerProfileHref, swimmerReturnHref } from "./directory";

test("directory filters survive profile navigation and changes of profile tab", () => {
  const directory = swimmerDirectoryHref({ q: " Alex Example ", status: "INACTIVE", page: 3 });
  for (const tab of [undefined, "progress", "attendance"]) {
    const profile = new URL(swimmerProfileHref("swimmer-1", directory, tab), "https://swimly.test");
    assert.equal(profile.pathname, "/students/swimmer-1");
    assert.equal(swimmerReturnHref(profile.searchParams.get("returnTo")!), directory);
    assert.equal(profile.searchParams.get("tab"), tab ?? null);
  }
});

test("return links cannot leave the directory or carry unrelated parameters", () => {
  for (const unsafe of ["https://example.com", "//example.com", "/students/123", "/students#x", ["/students?q=test"]]) {
    assert.equal(swimmerReturnHref(unsafe), "/students");
  }
  assert.equal(swimmerReturnHref("/students?q=Example&status=invalid&page=Infinity&redirect=bad"), "/students?q=Example");
});

test("invalid paging and repeated filters safely return to the first directory page", () => {
  for (const page of ["Infinity", "NaN", "1.5", "-3", "0", "9007199254740992"]) assert.equal(swimmerFilters({ page }).page, 1);
  assert.deepEqual(swimmerFilters({ q: ["a", "b"], status: "garbage", page: "2" }), { q: "", status: "ALL", page: 2 });
});
