import type { Metadata } from "next";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ParentAccounts } from "@/components/parents/parent-accounts";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Parent accounts" };

export default async function ParentAccountsPage() {
  await screenPage("students", "parents.manage");
  return <div className="min-w-0 space-y-6">
    <BackLink href="/students" current="Parent accounts">Swimmers</BackLink>
    <PageHeader title="Parent accounts" description="Find a Bookly account to check its details or manage sign-in access." />
    <ParentAccounts />
  </div>;
}
