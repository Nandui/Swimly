"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Field, FormDialog } from "@/components/form-dialog";
import { formatTimeRange } from "@/lib/format";
import { askForCover } from "@/modules/plan/features/day/server/cover-actions";
import type { PlanDayData } from "@/modules/plan/features/day/server/data";
import { ChoiceField, TimeField } from "@/modules/plan/shared/components/fields";
import { offerLine } from "@/modules/plan/shared/cover";

export type CoverRequest = PlanDayData["cover"][number];

/** Ask the department's staff, in its Google Chat space, to cover a stretch nobody fills (D31).
 *  `departments` are the ones that can be asked: one when the duty has its own, else a choice. */
export function AskCoverDialog({ siteId, date, needKey, what, start, end, departments, onDone }: {
  siteId: string; date: string; needKey: string; what: string; start: number; end: number; departments: { id: string; name: string }[]; onDone?: () => void;
}) {
  const router = useRouter();
  const fresh = { start, end, departmentId: departments[0]?.id ?? "", note: "" };
  const [f, setF] = useState(fresh);
  return (
    <FormDialog portalClassName="turnfin-module" trigger={<Button variant="outline" className="min-h-11"><MessageSquarePlus aria-hidden="true" />Ask in Google Chat</Button>}
      title="Ask staff to cover" description={`${what}. Staff answer in Google Chat; you choose who covers it.`}
      submitLabel="Ask" successMessage="Asked in Google Chat" onOpen={() => setF(fresh)} onSuccess={() => { router.refresh(); onDone?.(); }}
      submit={() => askForCover({ siteId, date, needKey, start: f.start, end: f.end, departmentId: f.departmentId, note: f.note })}>
      {departments.length > 1 ? (
        <ChoiceField id="plan-cover-department" label="Ask" value={f.departmentId} onChange={(v) => setF((x) => ({ ...x, departmentId: v }))} options={departments} empty="Choose a department" />
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <TimeField id="plan-cover-start" label="From" value={f.start} onChange={(v) => setF((x) => ({ ...x, start: v ?? 0 }))} />
        <TimeField id="plan-cover-end" label="To" value={f.end} onChange={(v) => setF((x) => ({ ...x, end: v ?? 0 }))} />
      </div>
      <Field label="Note" htmlFor="plan-cover-note" optional hint="Anything they should know, such as where to report.">
        <Input id="plan-cover-note" className="min-h-11" maxLength={200} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
      </Field>
    </FormDialog>
  );
}

/** Who has answered a request, the yeses first, each with what to know before choosing them. */
export function CoverAnswers({ request, pending, onChoose }: { request: CoverRequest; pending: boolean; onChoose: (userId: string, name: string) => void }) {
  const answers = [...request.answers].sort((a, b) => Number(b.answer === "yes") - Number(a.answer === "yes"));
  return (
    <section aria-label="Asked in Google Chat" className="flex flex-col gap-1">
      <h3 className="font-semibold">Asked in Google Chat</h3>
      <p className="text-sm text-ui-muted-foreground">
        {request.askedByName} asked {request.department} for {formatTimeRange(request.start, request.end)}. {offerLine(request.answers)}.{request.note ? ` Note: ${request.note}` : ""}
      </p>
      {answers.length ? (
        <ul className="pc-list">
          {answers.map((a) => (
            <li key={a.userId} className="pc-row">
              <span className="pc-row-body">
                <span className="pc-row-title">{a.name}</span>
                <span className="pc-row-hint">{a.answer === "no" ? "Can't cover" : [a.shift ? `On shift ${formatTimeRange(a.shift.start, a.shift.end)}` : "Not working this day",
                  a.qualified ? null : "Not qualified", a.off ? "Marked off" : null].filter(Boolean).join(" · ")}</span>
              </span>
              {a.answer === "yes" && request.canChoose
                ? <Button className="min-h-11" variant={a.qualified && !a.off ? "default" : "outline"} disabled={pending} onClick={() => onChoose(a.userId, a.name)}>Choose</Button> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
