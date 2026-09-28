import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

type Page = typeof import("@/app/(activities)/reception/page");

test("old Reception and Open Swimly links open the home page", () => {
  for (const file of ["src/app/(activities)/reception/page.tsx", "src/app/(activities)/start/page.tsx"]) {
    const page = serverModule<Page>(file, {
      "next/navigation": { redirect: (href: string) => { throw new Error(`Redirect ${href}`); } },
    }).default;
    assert.throws(() => page(), { message: "Redirect /" });
  }
});
