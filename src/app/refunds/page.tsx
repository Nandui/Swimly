import { listRefunds, type RefundFilters } from "@/lib/refunds/data";
import { RefundQueue } from "@/components/refunds/queue";

export default async function RefundsPage({ searchParams }: PageProps<"/refunds">) {
  const raw = await searchParams;
  const filters = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string")) as RefundFilters;
  return <RefundQueue key={JSON.stringify(filters)} data={await listRefunds(filters)} />;
}
