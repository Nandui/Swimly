import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ParentAccounts } from "@/modules/activities/components/parents/parent-accounts";
import { ParentAccessRequests } from "@/modules/activities/components/parents/access-requests";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Parent accounts" };

export default async function ParentAccountsPage() {
  await screenPage("students", "parents.manage");
  return <div className="min-w-0 space-y-6">
    <PageHeader back={{ href: "/students", label: "Swimmers" }} title="Parent accounts" description="Review family requests and manage access to LeisureWorld Aquatics." />
    <ParentAccessRequests />
    <section className="space-y-4 border-t border-ui-border pt-6" aria-labelledby="find-parent-heading"><h2 id="find-parent-heading" className="text-xl font-semibold">Find a parent account</h2><ParentAccounts /></section>
  </div>;
}
