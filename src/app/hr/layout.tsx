import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { HrShell } from "@/components/hr/shell";
import { hrAccess } from "@/lib/hr/access";
import { hrConfigured } from "@/lib/hr/database";
import { pageSession } from "@/lib/page-guards";
import { NAV_COLLAPSED_COOKIE } from "@/lib/shell-preferences";

export const metadata: Metadata = { title: { default: "Turnfin HR", template: "%s · Turnfin HR" } };

/** The restricted HR workspace. Opens only for a restricted HR role (at any
 *  scope) or a superadmin; each page asks for a recent password and limits
 *  records to the people the role covers. */
export default async function HrLayout({ children }: { children: ReactNode }) {
  const who = hrAccess(await pageSession());
  if (!who) notFound();
  const collapsed = (await cookies()).get(NAV_COLLAPSED_COOKIE)?.value === "1";
  return (
    <HrShell who={who} initialCollapsed={collapsed}>
      {hrConfigured() ? children : (
        <div className="min-w-0 flex flex-col gap-6">
          <PageHeader title="HR and performance" />
          <Notice tone="info" title="HR storage is not set up yet" description="HR records live in their own database. Once it is provisioned (HR_DATABASE_URL), this workspace opens. Nothing else in Turnfin is affected." />
        </div>
      )}
    </HrShell>
  );
}
