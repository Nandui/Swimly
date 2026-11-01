import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { areaNamesAt } from "@/lib/directory";
import { PhotoStrip } from "@/modules/maintenance/features/photos";
import { getMaintenanceRequest, MaintenanceError, maintenanceNumber, RequestView } from "@/modules/maintenance/features/requests";

/** One query per request, shared by the page and its tab title. */
const load = cache(getMaintenanceRequest);

export async function generateMetadata({ params }: PageProps<"/maintenance/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: maintenanceNumber((await load(id)).request.number) };
  } catch (error) {
    // The page turns these into a 404, so the title is the 404 page's.
    if (error instanceof MaintenanceError) return { title: "Page not found" };
    throw error;
  }
}

export default async function MaintenanceRequestPage({ params }: PageProps<"/maintenance/[id]">) {
  const { id } = await params;
  const data = await load(id).catch((error) => {
    if (error instanceof MaintenanceError) notFound();
    throw error;
  });
  const areas = data.can.manage ? await areaNamesAt(data.request.siteId) : [];
  return <RequestView data={data} areas={areas}
    photos={<PhotoStrip requestId={data.request.id} photos={data.photos} canAdd={data.can.addPhoto} canRemove={data.can.removePhoto} />} />;
}
