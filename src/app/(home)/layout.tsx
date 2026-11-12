import type { ReactNode } from "react";
import { HomeShell } from "@/components/home/home-shell";
import { getCurrentClub } from "@/lib/clubs/current";
import { pageSession } from "@/lib/page-guards";
import "../workspace/module-workspace.css";

/** Home's frame, outside the page so it shows at once while the modules' figures load
 *  (`loading.tsx` streams the page in behind it), like the Account frame. */
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  const sites = await getCurrentClub().catch(() => null);
  return (
    <HomeShell who={{ id: session.user.id, name: session.user.name ?? "Staff member" }} sites={sites}>
      {children}
    </HomeShell>
  );
}
