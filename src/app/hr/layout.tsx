import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { HrShell } from "@/modules/hr/components/shell";
import { hrAccess } from "@/modules/hr/lib/access";
import { hrConfigured } from "@/modules/hr/lib/database";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "HR", template: TITLE_TEMPLATE } };

/** The restricted HR workspace. Opens only for a restricted HR role (at any
 *  scope) or a superadmin; each page asks for a recent password and limits
 *  records to the people the role covers. */
export default async function HrLayout({ children }: { children: ReactNode }) {
  const who = hrAccess(await pageSession());
  if (!who) notFound();
  return (
    <HrShell who={who}>
      {hrConfigured() ? children : (
        <>
          <PageHeader title="HR" />
          {/* Setup steps live in docs/hr.md; staff only need to know who to ask. */}
          <Notice tone="info" title="HR isn’t switched on yet" description="Ask your Turnfin administrator to turn it on." />
        </>
      )}
    </HrShell>
  );
}
