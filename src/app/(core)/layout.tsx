import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CoreShell, type CoreLinkKey } from "@/components/core/shell";
import { canSee } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Admin", template: TITLE_TEMPLATE } };

const CORE_SCREENS = ["staff", "roles", "departments", "positions", "clubs", "areas", "activity-list", "qualifications", "activity"] as const satisfies readonly CoreLinkKey[];

/** Turnfin Core (the Admin module): People, Places, Work and the log, outside any
 *  module's workspace. Each page asks for its own screen and permission; /core
 *  sends someone who can open none of them Home. The person's own Account is
 *  not here: it lives at src/app/account in the Home frame. */
export default async function CoreLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  // Apps is a superadmin's page, not a screen a role opens.
  const screens: CoreLinkKey[] = [...CORE_SCREENS.filter((screen) => canSee(session, screen)), ...(session.user.isSuperadmin ? ["apps" as const] : [])];
  return (
    <CoreShell who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }} screens={screens}>
      {children}
    </CoreShell>
  );
}
