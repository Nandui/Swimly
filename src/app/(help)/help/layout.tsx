import type { Metadata } from "next";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";

export const metadata: Metadata = {
  title: { default: "Help centre", template: TITLE_TEMPLATE },
  robots: { index: false, follow: false },
};

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  await pageSession();
  return children;
}
