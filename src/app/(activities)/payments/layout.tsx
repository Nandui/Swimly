import type { ReactNode } from "react";
import { screenPage } from "@/lib/page-guards";
import { requirePaymentsActor } from "@/modules/activities/features/failed-payments";

/** Failed payments sit in the swim school's frame (D23); this checks the screen and the actor
 *  once for every page under it. */
export default async function PaymentsLayout({ children }: { children: ReactNode }) {
  await screenPage("payments");
  await requirePaymentsActor();
  return children;
}
