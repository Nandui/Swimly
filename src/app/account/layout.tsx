import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HomeShell } from "@/components/home/home-shell";
import { TITLE_TEMPLATE } from "@/lib/app";
import { getCurrentClub } from "@/lib/clubs/current";
import { pageSession } from "@/lib/page-guards";
import "../workspace/module-workspace.css";

export const metadata: Metadata = { title: { default: "Account", template: TITLE_TEMPLATE } };

/** The person's own Account (password, PIN, appearance, what their role lets
 *  them do). It is not part of Admin: it sits in the Home frame, with Home
 *  current in the rail and no page bar; the H1 names the page. Every
 *  signed-in person can open it. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await pageSession();
  const sites = await getCurrentClub().catch(() => null);
  return (
    <HomeShell who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Staff" }} sites={sites} account>
      {children}
    </HomeShell>
  );
}
