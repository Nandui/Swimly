import type { Metadata } from "next";
import { maintenanceLists, RequestList } from "@/modules/maintenance/features/requests";

export const metadata: Metadata = { title: "Maintenance requests" };

export default async function MaintenancePage({ searchParams }: PageProps<"/maintenance">) {
  const raw = await searchParams;
  const one = (key: string) => (typeof raw[key] === "string" ? raw[key] as string : undefined);
  return <RequestList data={await maintenanceLists({ show: one("show"), site: one("site"), page: one("page") })} />;
}
