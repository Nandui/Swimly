import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type User = { home: string; screens: string[]; permissions: string[] };
const routes = ["src/app/(app)/page.tsx", "src/app/(app)/start/page.tsx"];

function page(file: string, user: User | null) {
  return serverModule<typeof import("@/app/(app)/page")>(file, {
    "@/auth": { auth: async () => user ? { user } : null },
    "@/lib/authz": {},
    "next/navigation": { redirect: (href: string) => { throw new Error(`Redirect ${href}`); } },
  }).default;
}

test("root bookmarks and sign-in use Today for old administrator Overview homes", async () => {
  for (const route of routes) {
    const home = page(route, { home: "overview", screens: ["overview"], permissions: ["staff.manage", "roles.manage"] });
    await assert.rejects(home(), { message: "Redirect /schedule" });
  }
});

test("home redirects retain duty and instructor destinations and honour restricted screen access", async () => {
  const cases: [User, string][] = [
    [{ home: "overview", screens: ["overview", "calendar"], permissions: [] }, "/schedule"],
    [{ home: "duty", screens: ["calendar", "duty"], permissions: ["classes.cancel"] }, "/duty"],
    [{ home: "instructor", screens: ["instructor"], permissions: ["attendance.mark"] }, "/instructor"],
    [{ home: "overview", screens: ["overview", "students"], permissions: [] }, "/students"],
    [{ home: "overview", screens: ["overview"], permissions: [] }, "/account"],
    [{ home: "overview", screens: [], permissions: [] }, "/account"],
  ];
  for (const route of routes) {
    for (const [user, href] of cases) await assert.rejects(page(route, user)(), { message: `Redirect ${href}` });
  }
});

test("root and sign-in landing routes still require authentication", async () => {
  for (const route of routes) await assert.rejects(page(route, null)(), { message: "Redirect /sign-in" });
});
