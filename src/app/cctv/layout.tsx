import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { cctvAccess, CctvShell } from "@/modules/cctv/features/workspace";
import { pageSession } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "CCTV log", template: TITLE_TEMPLATE } };

/** The CCTV log: opens with `cctv.record` at any scope; pages limit entries to the person's own and, with Review, their sites'. */
export default async function CctvLayout({ children }: { children: ReactNode }) {
  const who = cctvAccess(await pageSession());
  if (!who) notFound();
  return <CctvShell who={who}>{children}</CctvShell>;
}
