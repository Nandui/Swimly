import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ParentAccessRequests, ParentAccounts } from "@/modules/activities/features/parents";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Parent accounts" };

export default async function ParentAccountsPage() {
  await screenPage("students", "parents.manage");
  return <div className="tf-content min-w-0">
    <PageHeader back={{ href: "/students", label: "Swimmers" }} title="Parent accounts" description="Review family requests and manage access to the parent app" />
    <ParentAccessRequests />
    <section className="pc-panel" aria-labelledby="find-parent-heading">
      <div className="min-w-0"><h2 id="find-parent-heading">Find a parent account</h2><p className="pc-row-hint">Enter the full address the parent uses to sign in to the parent app.</p></div>
      <ParentAccounts />
    </section>
  </div>;
}
