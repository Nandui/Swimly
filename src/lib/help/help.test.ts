import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { HELP_ARTICLES, articlesForScope, summarizeArticle } from "./catalogue";
import { helpFilters, helpHref, searchHelp } from "./search";
import { HELP_CATEGORIES } from "./types";
import { readFileSync } from "node:fs";
import { GUIDE_SCREENSHOTS, HELP_IMAGE_DIMENSIONS } from "./screenshots";

test("every guide has a screenshot in each workspace and each caption follows an existing step", () => {
  for (const scope of ["desk", "instructor"] as const) for (const article of articlesForScope(scope)) {
    assert.ok(article.steps.some(step => step.screenshots?.length), `${scope}/${article.slug} has no screenshot`);
    for (const image of (GUIDE_SCREENSHOTS[article.slug] ?? []).filter(image => !image.scope || image.scope === scope)) {
      assert.ok(article.steps.some(step => step.title === image.step), `${scope}/${article.slug}: missing step ${image.step}`);
      assert.ok(Object.hasOwn(HELP_IMAGE_DIMENSIONS, image.image), `${article.slug}: unknown screenshot ${image.image}`);
      assert.ok(image.alt.length > 20 && image.caption.length > 20, article.slug);
    }
  }
});

test("screenshot dimensions match the committed PNGs", () => {
  for (const [id, dimensions] of Object.entries(HELP_IMAGE_DIMENSIONS)) {
    const png = readFileSync(`assets/help/${id}.png`);
    assert.equal(png.subarray(1, 4).toString(), "PNG", id);
    assert.deepEqual({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, dimensions, id);
  }
});

test("screenshot delivery authenticates and rejects unknown or traversal paths before reading files", async () => {
  let reads = 0;
  const imageRoute = (signedIn: boolean) => serverModule<typeof import("@/app/(help)/help/images/[id]/route")>("src/app/(help)/help/images/[id]/route.ts", {
    "@/auth": { auth: async () => signedIn ? session(["students"]) : null },
    "node:fs/promises": { readFile: async (file: string) => { reads++; assert.match(file, /assets[\\/]help[\\/]workspace\.png$/); return new Uint8Array([137, 80, 78, 71]); } },
  });
  const request = new Request("https://example.invalid/help/images/workspace");
  assert.equal((await imageRoute(false).GET(request, { params: Promise.resolve({ id: "workspace" }) })).status, 401);
  for (const id of ["unknown", "../../secret", "constructor", "workspace.png"]) {
    assert.equal((await imageRoute(true).GET(request, { params: Promise.resolve({ id }) })).status, 404);
  }
  assert.equal(reads, 0);
  const response = await imageRoute(true).GET(request, { params: Promise.resolve({ id: "workspace" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(reads, 1);
});

const deskIndex = articlesForScope("desk").map(summarizeArticle);
const session = (screens: string[], permissions: string[] = []) => ({ user: { id: "synthetic-staff", home: "calendar", screens, permissions } }) as Session;
function accessFor(user: Session | null) {
  return serverModule<typeof import("./access")>("src/lib/help/access.ts", {
    "@/lib/page-guards": { pageSession: async () => { if (!user) throw new Error("redirect:/sign-in"); return user; } },
    "next/navigation": { notFound: () => { throw new Error("404"); }, redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
  });
}

test("every guide has a stable unique address, usable content and valid related links", () => {
  const slugs = new Set(HELP_ARTICLES.map(article => article.slug));
  assert.equal(slugs.size, HELP_ARTICLES.length);
  for (const article of HELP_ARTICLES) {
    assert.match(article.slug, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(article.title && article.summary && article.result && article.before.length && article.steps.length && article.scopes.length, article.slug);
    assert.ok(article.steps.every(step => step.title && step.text), article.slug);
    for (const slug of article.related) assert.ok(slugs.has(slug) && slug !== article.slug, `${article.slug}: ${slug}`);
  }
  for (const category of HELP_CATEGORIES) assert.ok(HELP_ARTICLES.some(article => article.category === category.id), category.id);
});

test("search finds natural task phrases, spelling variants and specific terminology", () => {
  const cases = [
    ["how do I move a swimmer", "move-swimmer"], ["transfer", "move-swimmer"],
    ["sibbling times", "sibling-times"], ["enrollment", "enrol-swimmer"],
    ["take a register", "take-attendance"], ["billing notified", "billing-follow-up"],
    ["reset password", "manage-staff"],
  ];
  for (const [query, expected] of cases) {
    const results = searchHelp(deskIndex, helpFilters(query));
    assert.ok(results.slice(0, 3).some(article => article.slug === expected), `${query}: ${results.slice(0, 3).map(article => article.slug)}`);
  }
  assert.equal(searchHelp(deskIndex, helpFilters("zzzz-no-such-topic")).length, 0);
  assert.ok(searchHelp(deskIndex, helpFilters("", "teaching")).every(article => article.category === "teaching"));
});

test("Instructor search and related links include only teaching and shared help", () => {
  const articles = articlesForScope("instructor");
  assert.ok(articles.some(article => article.slug === "start-class"));
  assert.ok(!articles.some(article => article.category === "setup" || article.category === "enrolment"));
  for (const article of articles) {
    assert.ok(article.steps.every(step => !step.scopes || step.scopes.includes("instructor")));
    assert.ok(article.related.every(slug => articles.some(item => item.slug === slug)));
  }
  // Password recovery can legitimately mention an account manager, but never opens the staff administration guide.
  assert.ok(searchHelp(articles.map(summarizeArticle), helpFilters("manage staff accounts")).every(article => article.slug !== "manage-staff"));
  assert.equal(searchHelp(articles.map(summarizeArticle), helpFilters("temporary password")).length, 0);
});

test("help links preserve only bounded search and known topic state", () => {
  assert.deepEqual(helpFilters("x".repeat(200), "//example.com"), { q: "x".repeat(160), topic: "all" });
  assert.equal(helpHref("instructor", "take-attendance", helpFilters(" present & absent ", "teaching")), "/help/instructor/take-attendance?q=present+%26+absent&topic=teaching");
  assert.equal(helpHref("desk", undefined, helpFilters("", "unknown")), "/help");
});

test("unauthenticated help requests redirect for both workspaces and direct articles", async () => {
  const { helpPage } = accessFor(null);
  for (const scope of ["desk", "instructor"] as const) {
    await assert.rejects(helpPage(scope), /redirect:\/sign-in/);
    await assert.rejects(helpPage(scope, "take-attendance"), /redirect:\/sign-in/);
  }
});

test("Instructor-only roles and legacy grants are redirected to their scoped manual", async () => {
  for (const screens of [["instructor"], ["today"]]) {
    const access = accessFor(session(screens, ["attendance.mark"]));
    await assert.rejects(access.helpPage("desk", "take-attendance"), /redirect:\/help\/instructor\/take-attendance/);
    await assert.rejects(access.helpPage("desk", "manage-staff"), /redirect:\/help\/instructor$/);
    assert.equal((await access.helpPage("instructor")).home, "/instructor");
  }
});

test("help does not grant Instructor access through a screen or attendance permission alone", async () => {
  for (const user of [session(["instructor"]), session(["calendar"], ["attendance.markAny"])]) {
    const access = accessFor(user);
    await assert.rejects(access.helpPage("instructor"), /404/);
    assert.ok(await access.helpPage("desk"));
  }
});

test("Open in app links respect screen grants and workspace boundaries", () => {
  const user = session(["students", "programmes"], []);
  const { helpAccess } = accessFor(user);
  const access = helpAccess(user, "desk");
  assert.equal(access.action(HELP_ARTICLES.find(article => article.slug === "find-swimmer")!)?.href, "/students");
  assert.equal(access.action(HELP_ARTICLES.find(article => article.slug === "manage-curriculum")!), undefined);
  assert.equal(access.action(HELP_ARTICLES.find(article => article.slug === "start-class")!), undefined);
  const admin = session([], ["staff.manage", "roles.manage"]);
  assert.equal(helpAccess(admin, "desk").action(HELP_ARTICLES.find(article => article.slug === "manage-curriculum")!)?.href, "/programmes");
  assert.equal(helpAccess(admin, "instructor").action(HELP_ARTICLES[0])?.href, "/instructor");
  assert.notEqual(helpAccess(admin, "desk").home, "/instructor");
});
