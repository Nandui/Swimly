import type { Metadata } from "next";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = {
  title: "Help centre",
  robots: { index: false, follow: false },
};

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  await pageSession();
  return children;
}
