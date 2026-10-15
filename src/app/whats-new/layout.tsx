import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HomeShell } from "@/components/home/home-shell";
import { TITLE_TEMPLATE } from "@/lib/app";
import { getCurrentClub } from "@/lib/clubs/current";
import { pageSession } from "@/lib/page-guards";
import "../workspace/module-workspace.css";

export const metadata: Metadata = { title: { default: "What's new", template: TITLE_TEMPLATE } };

/** What's new: Turnfin's version and the release notes, for anyone curious. Like Account it
 *  sits in the Home frame, opened from the account menu, and every signed-in person can open it. */
export default async function WhatsNewLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  const sites = await getCurrentClub().catch(() => null);
  return (
    <HomeShell who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }} sites={sites} page={{ name: "What's new", scope: "Everyone" }}>
      {children}
    </HomeShell>
  );
}
