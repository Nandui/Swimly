import type { Metadata } from "next";
import type { ReactNode } from "react";
import { screenPage } from "@/lib/page-guards";
import { TITLE_TEMPLATE } from "@/lib/app";
import { CoinageShell, requireCoinageActor } from "@/modules/coinage/features/workspace";
import '../workspace/module-workspace.css';

export const metadata: Metadata = { title: { default: "Coinage", template: TITLE_TEMPLATE } };
export default async function CoinageLayout({ children }: { children: ReactNode }) {
  await screenPage("coinage");
  const who = await requireCoinageActor();
  return <CoinageShell who={who}>{children}</CoinageShell>;
}
