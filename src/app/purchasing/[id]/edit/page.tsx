import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { OrderForm } from "@/modules/purchasing/components/order-form";
import { orderForm } from "@/modules/purchasing/lib/data";

export const metadata: Metadata = { title: "Change order" };

/** Change your own draft or rejected order, then send it again. */
export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await orderForm((await params).id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Change purchase order" description="Change it and send it for approval again." back={data.existing ? { href: `/purchasing/${data.existing.id}`, label: "The order" } : undefined} />
      <OrderForm sites={data.sites} suppliers={data.suppliers} rules={data.rules} roleNames={data.roleNames} existing={data.existing} />
    </div>
  );
}
