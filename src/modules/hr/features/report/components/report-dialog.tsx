"use client";

import { useState } from "react";
import { FilePen } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Input } from "@/components/shadcn/input";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { NOTE_KIND_META, REPORT_KINDS } from "@/modules/hr/shared/constants";
import { fileReport } from "@/modules/hr/features/report/server/actions";
import { THEME } from "@/modules/hr/shared/components/dialog-kit";

/** The quick report: what it is about, what happened and when. `today` and
 *  `now` are the pool's day and time (HH:MM), from the server. */
export function ReportDialog({ subjectUserId, name, today, now }: { subjectUserId: string; name: string; today: string; now: string }) {
  const [kind, setKind] = useState("");
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button variant="outline" className="min-h-11"><FilePen aria-hidden="true" />Report</Button>}
      title={`Report about ${name}`}
      description="Good work or an issue. Keep to facts: what happened and what you did. It goes on their HR file against your name. They are not told, and you can't open it again."
      submitLabel="Send report"
      successMessage="Report sent"
      onOpen={() => setKind("")}
      submit={(formData) => fileReport(subjectUserId, {
        kind, body: String(formData.get("body") ?? ""), date: String(formData.get("date") ?? ""), time: String(formData.get("time") ?? ""),
      })}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">What it is about</legend>
        <RadioGroup value={kind} onValueChange={setKind} className="gap-2" required>
          {REPORT_KINDS.map((key) => (
            <ChoiceRow key={key} type="radio" id={`hr-kind-${key}`} value={key} title={NOTE_KIND_META[key].label} />
          ))}
        </RadioGroup>
      </fieldset>
      <Field label="What happened" htmlFor="hr-report-body">
        <Textarea id="hr-report-body" name="body" rows={5} required minLength={3} maxLength={5000} />
      </Field>
      <div className="grid grid-cols-2 gap-(--space-3)">
        <Field label="Day" htmlFor="hr-report-date">
          <Input id="hr-report-date" name="date" type="date" required defaultValue={today} max={today} />
        </Field>
        <Field label="Time" htmlFor="hr-report-time">
          <Input id="hr-report-time" name="time" type="time" required defaultValue={now} />
        </Field>
      </div>
    </FormDialog>
  );
}
