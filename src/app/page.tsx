import { redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";

/** The staff portal is the front door; /start still opens the role's Swimly home. */
export default async function HomePage() {
  await pageSession();
  redirect("/modules");
}
