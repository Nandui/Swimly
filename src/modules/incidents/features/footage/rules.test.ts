import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDetails, footageName, footagePath, footageProblem, footageRequestSchema, footageType, linkExpiry, linkProblem, MAX_FOOTAGE_BYTES,
  MAX_FOOTAGE_FILES, sizeLabel, tokenShape,
} from "./rules";

test("footage types come from the extension, never the browser", () => {
  assert.equal(footageType("Camera 3.MP4"), "video/mp4");
  assert.equal(footageType("export.dav"), "application/octet-stream");
  assert.equal(footageType("nvr-export.zip"), "application/zip");
  assert.equal(footageType("player.exe"), null);
  assert.equal(footageType("clip.mp4.exe"), null);
  assert.equal(footageType("no-extension"), null);
});

test("a video is refused for its type, size or the request being full", () => {
  assert.equal(footageProblem({ name: "a.mp4", size: 10 }, 0), null);
  assert.match(footageProblem({ name: "a.exe", size: 10 }, 0)!, /type isn't accepted/);
  assert.match(footageProblem({ name: "a.mp4", size: 0 }, 0)!, /empty/);
  assert.match(footageProblem({ name: "a.mp4", size: MAX_FOOTAGE_BYTES + 1 }, 0)!, /5 GB/);
  assert.equal(footageProblem({ name: "a.mp4", size: MAX_FOOTAGE_BYTES }, MAX_FOOTAGE_FILES - 1), null);
  assert.match(footageProblem({ name: "a.mp4", size: 10 }, MAX_FOOTAGE_FILES)!, /already has/);
});

test("a link stops when cancelled, when the report closes or when it expires", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const open = { status: "open", expiresAt: linkExpiry(now), report: { status: "investigating" } };
  assert.equal(linkProblem(open, now), null);
  assert.equal(linkExpiry(now).toISOString(), "2026-11-02T12:00:00.000Z");
  assert.match(linkProblem({ ...open, status: "cancelled" }, now)!, /cancelled/);
  assert.match(linkProblem({ ...open, report: { status: "closed" } }, now)!, /closed/);
  assert.match(linkProblem({ ...open, expiresAt: now }, now)!, /expired/);
});

test("each video has its own path under its request, safe whatever its name", () => {
  assert.equal(footagePath("req1", "f1", "Cam 2 (pool).mp4"), "incidents/footage/req1/f1-Cam-2-pool-.mp4");
  assert.equal(footagePath("req1", "f1", "../../x.mp4"), "incidents/footage/req1/f1-.-.-x.mp4");
  assert.equal(footageName("a/b\\c\u0000.mp4"), "a_b_c_.mp4");
  assert.equal(footageName("   "), "footage");
});

test("the link's secret has one shape", () => {
  assert.equal(tokenShape("a".repeat(43)), true);
  assert.equal(tokenShape("a".repeat(42)), false);
  assert.equal(tokenShape(`${"a".repeat(42)}/`), false);
});

test("the request starts from the day, time and place, never who or what", () => {
  const day = (iso: string) => `day ${iso}`;
  assert.equal(defaultDetails({ occurredOn: "2026-10-18", occurredAt: "14:05", area: "Main pool", site: "Mahon" }, day),
    "CCTV from Main pool at Mahon on day 2026-10-18, between 13:50 and 14:20.");
  assert.equal(defaultDetails({ occurredOn: "2026-10-18", occurredAt: "00:05", area: "", site: "Mahon" }, day),
    "CCTV from Mahon on day 2026-10-18, between 00:00 and 00:20.");
});

test("a request needs enough detail to find the footage", () => {
  assert.equal(footageRequestSchema.safeParse({ userId: "", name: "A", email: "a@b.ie", details: "short" }).success, false);
  assert.equal(footageRequestSchema.safeParse({ userId: "", name: "A", email: "a@b.ie", details: "Camera 4, 14:00 to 14:30" }).success, true);
});

test("sizes read as people say them", () => {
  assert.equal(sizeLabel(2048), "2 KB");
  assert.equal(sizeLabel(5 * 1024 ** 2), "5.0 MB");
  assert.equal(sizeLabel(3 * 1024 ** 3), "3.00 GB");
});
