import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { visibleScreens } from "@/lib/staff/screens";
import { expandPermissions } from "@/lib/staff/permissions";

type Page = typeof import("@/app/(app)/reception/page");
type User = { home: string; screens: string[]; permissions: string[] };

function retiredPage(user: User | null) {
  return serverModule<Page>("src/app/(app)/reception/page.tsx", {
    "@/auth": { auth: async () => user ? { user } : null },
    "@/lib/authz": { canSee: (session: { user: User }, screen: "students") =>
      visibleScreens(session.user.screens, expandPermissions(session.user.permissions)).has(screen) },
    "next/navigation": { redirect: (href: string) => { throw new Error(`Redirect ${href}`); } },
  }).default;
}

test("old Reception bookmarks retain their selected swimmer only with profile access", async () => {
  const page = retiredPage({ home: "reception", screens: ["reception", "students"], permissions: [] });
  await assert.rejects(page({ searchParams: Promise.resolve({ swimmer: "synthetic&swimmer" }) }),
    { message: "Redirect /students/synthetic%26swimmer" });
  for (const swimmer of [undefined, ["one", "two"], "x".repeat(121)]) {
    await assert.rejects(page({ searchParams: Promise.resolve({ swimmer }) }), { message: "Redirect /students" });
  }
});

test("removed Reception access does not grant a new screen or produce a redirect loop", async () => {
  for (const [screens, expected] of [[[], "/account"], [["reception"], "/account"], [["overview", "reception"], "/"], [["calendar", "reception"], "/today"]] as const) {
    const page = retiredPage({ home: "reception", screens: [...screens], permissions: [] });
    await assert.rejects(page({ searchParams: Promise.resolve({ swimmer: "synthetic" }) }), { message: `Redirect ${expected}` });
  }
});

test("Reception bookmarks still require sign-in", async () => {
  await assert.rejects(retiredPage(null)({ searchParams: Promise.resolve({ swimmer: "synthetic" }) }),
    { message: "Redirect /sign-in" });
});
