"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { FormDialog } from "@/components/form-dialog";
import { setSessionDay } from "@/modules/plan/features/day/server/actions";
import { TimeField } from "@/modules/plan/shared/components/fields";

/** Change one day of a session (new times) or call it off that day; the rest of its days stay. */
export function SessionDayDialog({ sessionId, title, date, start, end }: { sessionId: string; title: string; date: string; start: number; end: number }) {
  const router = useRouter();
  const [f, setF] = useState({ cancelled: false, start, end });
  return (
    <FormDialog portalClassName="turnfin-module" trigger={<Button variant="outline" className="min-h-11">Change</Button>}
      title={`${title}, this day only`} description="New times or calling it off apply to this day; its other days stay as they are."
      submitLabel="Save" successMessage="Day changed" onOpen={() => setF({ cancelled: false, start, end })} onSuccess={() => router.refresh()}
      submit={() => setSessionDay({ sessionId, date, cancelled: f.cancelled, start: f.cancelled ? null : f.start, end: f.cancelled ? null : f.end })}>
      <div className="flex min-h-11 items-center gap-3">
        <Checkbox id="plan-day-off" checked={f.cancelled} onCheckedChange={(v) => setF((x) => ({ ...x, cancelled: v === true }))} />
        <Label htmlFor="plan-day-off">Not on this day</Label>
      </div>
      {f.cancelled ? null : (
        <div className="grid grid-cols-2 gap-4">
          <TimeField id="plan-day-start" label="From" value={f.start} onChange={(v) => setF((x) => ({ ...x, start: v ?? 0 }))} />
          <TimeField id="plan-day-end" label="To" value={f.end} onChange={(v) => setF((x) => ({ ...x, end: v ?? 0 }))} />
        </div>
      )}
    </FormDialog>
  );
}
