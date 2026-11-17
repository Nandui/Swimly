"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FormDialog } from "@/components/form-dialog";
import { formatDay } from "@/lib/format";
import { copyDayPlan } from "@/modules/plan/features/day/server/actions";
import { ChoiceField } from "@/modules/plan/shared/components/fields";
import { shiftIso } from "@/modules/plan/shared/model";

/** Copy another day's plan into this one (owner, 16 November 2026): the same day last week comes
 *  first when it has a plan, and any other day of the last four weeks can be picked instead. Says
 *  what it does and doesn't touch before it does it. */
export function CopyDayButton({ siteId, date, days }: { siteId: string; date: string; days: { date: string; shifts: number }[] }) {
  const router = useRouter();
  const lastWeek = shiftIso(date, -7);
  const first = days.find((d) => d.date === lastWeek) ?? days[0];
  const [from, setFrom] = useState(first.date);
  const options = [first, ...days.filter((d) => d !== first)].map((d) => ({ id: d.date, name: `${formatDay(d.date)} · ${d.shifts} ${d.shifts === 1 ? "shift" : "shifts"}${d.date === lastWeek ? " · same day last week" : ""}` }));
  return (
    <FormDialog portalClassName="turnfin-module" trigger={<Button variant="outline" className="min-h-11"><Copy aria-hidden="true" />Copy a day</Button>}
      title={`Copy another day into ${formatDay(date)}?`}
      description="Each shift is copied at the same times with what the person is on and their positions. Anything for an activity that isn't on this day is left out. Anyone marked off, or already planned this day, is skipped."
      submitLabel="Copy" successMessage="Day copied" onOpen={() => setFrom(first.date)} onSuccess={() => router.refresh()}
      submit={async () => { const result = await copyDayPlan(siteId, from, date); return result.ok ? { ok: true } : result; }}>
      <ChoiceField id="plan-copy-day" label="Copy from" value={from} onChange={setFrom} options={options} empty="Choose a day" />
    </FormDialog>
  );
}
