import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { CoreShell, type CoreLinkKey } from "@/components/core/shell";
import { canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import '../docs/docs.css';
import '../docs/integration.css';
import '../docs/brand.css';
import '../docs/poolside.css';
import '../workspace/module-workspace.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';

export const metadata: Metadata = { title: { default: "Turnfin Core", template: "%s · Turnfin Core" }, icons: { icon: "/brand/turnfin.png" } };

const CORE_SCREENS: CoreLinkKey[] = ["staff", "roles", "clubs", "activity"];

/** Turnfin Core: Staff, Roles, Clubs, Activity and Account, outside any module's
 *  workspace. Every signed-in person can open it (Account is always there);
 *  each page still asks for its own screen and permission. */
export default async function CoreLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  const screens = CORE_SCREENS.filter((screen) => canSee(session, screen));
  const collapsed = (await cookies()).get("turnfin.core.sidebar")?.value === "collapsed";
  return (
    <CoreShell who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }} screens={screens} initialCollapsed={collapsed}>
      {children}
    </CoreShell>
  );
}
