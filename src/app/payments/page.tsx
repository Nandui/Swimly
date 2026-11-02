import type { Metadata } from "next";
import { FailureList, paymentLists } from "@/modules/payments/features/failures";

export const metadata: Metadata = { title: "Failed payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const raw = await searchParams;
  const one = (key: string) => (typeof raw[key] === "string" ? raw[key] as string : undefined);
  return <FailureList data={await paymentLists({ show: one("show"), site: one("site"), month: one("month"), q: one("q"), page: one("page") })} />;
}
