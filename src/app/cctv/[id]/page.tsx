import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { AddViewingNote, cctvViewing, reasonMeta, viewingNumber, ViewingView } from "@/modules/cctv/features/viewings";

export const metadata: Metadata = { title: "CCTV viewing" };

/** One saved viewing as written, its notes, and Add a note for those who may. */
export default async function CctvViewingPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await cctvViewing((await params).id);
  const v = data.viewing;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<span className="tabular-nums">{viewingNumber(v.number)}</span>} back={{ href: "/cctv", label: "Viewings" }}
        status={<Tag meta={reasonMeta(v.reason)} />} description={v.purpose}
        actions={data.canNote ? <AddViewingNote id={v.id} /> : undefined} />
      <ViewingView data={data} />
    </div>
  );
}
