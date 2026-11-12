import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { ParentAccessRequests, ParentAccounts } from "@/modules/activities/features/parents";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Parent accounts" };

export default async function ParentAccountsPage() {
  await screenPage("students", "parents.manage");
  return <PageShell className="tf-content" header={<PageHeader back={{ href: "/students", label: "Swimmers" }} title="Parent accounts" description="Review family requests and manage access to the parent app" />}>
    <ParentAccessRequests />
    <section className="flex min-w-0 flex-col" aria-labelledby="find-parent-heading">
      <div className="pc-section-head"><h2 id="find-parent-heading">Find a parent account</h2></div>
      <p className="pc-section-note">Enter the full address the parent uses to sign in to the parent app.</p>
      <ParentAccounts />
    </section>
  </PageShell>;
}
