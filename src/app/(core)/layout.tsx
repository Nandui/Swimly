import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CoreShell, type CoreLinkKey } from "@/components/core/shell";
import { canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Admin", template: TITLE_TEMPLATE } };

const CORE_SCREENS: CoreLinkKey[] = ["staff", "roles", "clubs", "activity"];

/** Turnfin Core (the Admin module): Staff, Roles, Sites and Activity, outside any
 *  module's workspace. Each page asks for its own screen and permission; /core
 *  sends someone who can open none of them Home. The person's own Account is
 *  not here: it lives at src/app/account in the Home frame. */
export default async function CoreLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  const screens = CORE_SCREENS.filter((screen) => canSee(session, screen));
  return (
    <CoreShell who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }} screens={screens}>
      {children}
    </CoreShell>
  );
}
