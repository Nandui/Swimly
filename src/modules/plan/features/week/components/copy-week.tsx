"use client";

import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FormDialog } from "@/components/form-dialog";
import { copyLastWeek } from "@/modules/plan/features/week/server/actions";

/** Copy last week's shifts into this week, after saying what it does and doesn't touch. */
export function CopyWeekButton({ siteId, departmentId, week, departmentName }: { siteId: string; departmentId: string; week: string; departmentName: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName="turnfin-module" trigger={<Button variant="outline" className="min-h-11"><Copy aria-hidden="true" />Copy last week</Button>}
      title={`Copy last week's ${departmentName} plan?`}
      description="Each shift moves on a week with its duties. Fills of sessions that no longer run are left out. Anyone marked off, or already planned here that day, is skipped."
      submitLabel="Copy last week" successMessage="Last week copied" onSuccess={() => router.refresh()}
      submit={async () => { const result = await copyLastWeek(siteId, departmentId, week); return result.ok ? { ok: true } : result; }}>
      {null}
    </FormDialog>
  );
}
