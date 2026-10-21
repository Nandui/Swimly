import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { CoinageDetail, CoinageError, coinageNumber, coinageSites, getCoinage, requireCoinageActor } from "@/modules/coinage/features/request";

/** One query per request, shared by the page and its tab title. */
const load = cache(getCoinage);

export async function generateMetadata({ params }: PageProps<"/coinage/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    await requireCoinageActor();
    return { title: coinageNumber((await load(id)).request.number) };
  } catch (error) {
    // The page turns these into a 404, so the title is the 404 page's.
    if (error instanceof CoinageError) return { title: "Page not found" };
    throw error;
  }
}

export default async function CoinageRequestPage({ params }: PageProps<"/coinage/[id]">) {
  const { id } = await params;
  const who = await requireCoinageActor();
  const [data, sites] = await Promise.all([load(id), coinageSites()]).catch(error => {
    if (error instanceof CoinageError) notFound();
    throw error;
  });
  return <CoinageDetail data={data} who={who} sites={sites} />;
}
