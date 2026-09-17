"use client";

import { Button } from "@/components/shadcn/button";
import { Check } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { confirmLegendAgreement } from "@/lib/enrolment/actions/legend-agreements";

export function ConfirmLegendAgreement({ id, swimmerName, classLabel }: { id: string; swimmerName: string; classLabel: string }) {
  return <ConfirmAction
    trigger={<Button className="min-h-11" aria-label={`Confirm Legend agreement for ${swimmerName} in ${classLabel}`}><Check aria-hidden="true" />Confirm updated</Button>}
    title="Agreement updated in Legend?"
    description={`Confirm that you have updated ${swimmerName}’s billing agreement in Legend for ${classLabel}. This removes this class place from the outstanding list.`}
    confirmLabel="Confirm updated" successMessage="Legend agreement confirmed"
    run={() => confirmLegendAgreement(id)}
  />;
}
