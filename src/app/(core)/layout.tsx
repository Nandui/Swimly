import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CoreShell, type CoreLinkKey } from "@/components/core/shell";
import { canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Turnfin Core", template: "%s · Turnfin Core" }, icons: { icon: "/brand/turnfin.png" } };

const CORE_SCREENS: CoreLinkKey[] = ["staff", "roles", "clubs", "activity"];

/** Turnfin Core: Staff, Roles, Clubs, Activity and Account, outside any module's
 *  workspace. Every signed-in person can open it (Account is always there);
 *  each page still asks for its own screen and permission. */
export default async function CoreLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  const screens = CORE_SCREENS.filter((screen) => canSee(session, screen));
  return (
    <CoreShell who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }} screens={screens}>
      {children}
    </CoreShell>
  );
}
