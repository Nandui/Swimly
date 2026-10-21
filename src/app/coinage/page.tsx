import type { Metadata } from "next";
import { CoinageQueue, listCoinage, type CoinageFilters } from "@/modules/coinage/features/queue";

export const metadata: Metadata = { title: "Coinage requests" };

export default async function CoinagePage({ searchParams }: PageProps<"/coinage">) {
  const raw = await searchParams;
  const filters = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === "string")) as CoinageFilters;
  return <CoinageQueue key={JSON.stringify(filters)} data={await listCoinage(filters)} />;
}
