import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { staffingAccess, StaffingShell, staffingSites } from "@/modules/staffing/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { rememberedSite } from "@/lib/remembered-site";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Staffing", template: TITLE_TEMPLATE } };

/** The Staffing workspace: opens with `staffing.read` at any scope; pages limit everything to the
 *  sites it covers. */
export default async function StaffingLayout({ children }: { children: ReactNode }) {
  const who = staffingAccess(await pageSession());
  if (!who) notFound();
  const [{ sites }, home] = await Promise.all([staffingSites(), rememberedSite("staffing")]);
  return <StaffingShell who={who} sites={sites.map(({ id, name }) => ({ id, name }))} home={home ?? null}>{children}</StaffingShell>;
}
