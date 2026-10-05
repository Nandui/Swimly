import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui-kit/notice";
import { HrShell } from "@/components/hr/shell";
import { hrAccess } from "@/lib/hr/access";
import { hrConfigured } from "@/lib/hr/database";
import { pageSession } from "@/lib/page-guards";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Turnfin HR", template: "%s · Turnfin HR" }, icons: { icon: "/brand/turnfin.png" } };

/** The restricted HR workspace. Opens only for a restricted HR role (at any
 *  scope) or a superadmin; each page asks for a recent password and limits
 *  records to the people the role covers. */
export default async function HrLayout({ children }: { children: ReactNode }) {
  const who = hrAccess(await pageSession());
  if (!who) notFound();
  return (
    <HrShell who={who}>
      {hrConfigured() ? children : (
        <div className="space-y-6">
          <div className="module-heading"><div className="space-y-2"><h1>HR and performance</h1></div></div>
          <Notice tone="info" title="HR storage is not set up yet" description="HR records live in their own database. Once it is provisioned (HR_DATABASE_URL, or the Neon integration with the HR_DB prefix), this workspace opens. Nothing else in Turnfin is affected." />
        </div>
      )}
    </HrShell>
  );
}
