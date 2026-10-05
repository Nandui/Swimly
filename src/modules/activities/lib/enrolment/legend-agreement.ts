import { CircleCheck, Clock3, ScanSearch } from "lucide-react";
import type { LegendAgreementStatus } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";

export const LEGEND_AGREEMENT_META = {
  NEEDS_CHECK: { label: "Needs checking", color: "gray", icon: ScanSearch },
  PENDING: { label: "Still to do", color: "orange", icon: Clock3 },
  DONE: { label: "Updated in Legend", color: "green", icon: CircleCheck },
} as const satisfies Record<LegendAgreementStatus, StatusMeta>;

export type LegendAgreementChoice = "PENDING" | "DONE";
export function readLegendAgreement(data: FormData): LegendAgreementChoice | undefined {
  const value = data.get("legendAgreement");
  return value === "PENDING" || value === "DONE" ? value : undefined;
}

export function agreementRecord(status: LegendAgreementChoice, actor: { id: string; name?: string | null }) {
  return {
    legendAgreementStatus: status,
    legendAgreementUpdatedAt: new Date(),
    legendAgreementUpdatedById: actor.id,
    legendAgreementUpdatedByName: actor.name ?? "Unknown",
  };
}
