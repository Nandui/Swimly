import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { OrderForm, orderForm } from "@/modules/purchasing/features/orders";

export const metadata: Metadata = { title: "New order" };

/** Raise a purchase order from an approved supplier. */
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  const data = await orderForm();
  if (!data.who.request) notFound();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="New purchase order" description="Only approved products from approved suppliers, at their agreed prices." />}>
      <OrderForm sites={data.sites} suppliers={data.suppliers} rules={data.rules} roleNames={data.roleNames} existing={null} initialSupplier={(await searchParams).supplier} />
    </PageShell>
  );
}
