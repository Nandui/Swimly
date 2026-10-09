"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { saveTaskSite } from "@/modules/tasks/lib/actions";
import { SITE_STATUSES, SITE_STATUS_META, TIMEZONES, type SiteStatus } from "@/modules/tasks/lib/rules";

const THEME = "turnfin-module turnfin-tasks";
type Site = { siteId: string; name: string; status: SiteStatus; area: string; timezone: string; opening: string; closing: string; closedDates: string[] };

/** A site's Tasks settings (the prototype's "Site settings"): whether it is live, its area and
 *  time zone, its business hours and its closed dates. Hours apply to tasks made from now on;
 *  tasks already made keep their times. */
export function SiteSettings({ site, label = "Site settings", variant = "outline" }: { site: Site; label?: string; variant?: "outline" | "default" }) {
  const router = useRouter();
  const fid = useId();
  const text = (form: FormData, key: string) => String(form.get(key) ?? "");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant={variant}><SlidersHorizontal aria-hidden="true" />{label}</Button>}
      title={`${site.name} settings`}
      description="Hours apply to tasks made from now on. Tasks already made keep their times."
      submitLabel="Save site"
      successMessage="Site settings saved"
      width="sm:max-w-lg"
      onSuccess={() => router.refresh()}
      submit={(form) => saveTaskSite(site.siteId, {
        status: text(form, "status") as SiteStatus, area: text(form, "area"), timezone: text(form, "timezone") as (typeof TIMEZONES)[number],
        opening: text(form, "opening"), closing: text(form, "closing"), closedDates: text(form, "closedDates").split(/[\s,]+/),
      })}
    >
      <Field label="Status" htmlFor={`${fid}-status`} hint="Tasks are made only at a live site.">
        <NativeSelect id={`${fid}-status`} name="status" defaultValue={site.status} className="w-full">
          {SITE_STATUSES.map((s) => <NativeSelectOption key={s} value={s}>{SITE_STATUS_META[s].label}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Area" htmlFor={`${fid}-area`} optional hint="A grouping, such as City or Coastal."><Input id={`${fid}-area`} name="area" maxLength={60} defaultValue={site.area} /></Field>
        <Field label="Time zone" htmlFor={`${fid}-tz`}>
          <NativeSelect id={`${fid}-tz`} name="timezone" defaultValue={site.timezone} className="w-full">
            {TIMEZONES.map((z) => <NativeSelectOption key={z} value={z}>{z.replace("_", " ")}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="Opening time" htmlFor={`${fid}-open`}><Input id={`${fid}-open`} name="opening" type="time" required defaultValue={site.opening} /></Field>
        <Field label="Closing time" htmlFor={`${fid}-close`}><Input id={`${fid}-close`} name="closing" type="time" required defaultValue={site.closing} /></Field>
      </div>
      <Field label="Closed dates" htmlFor={`${fid}-closed`} optional hint="No tasks are made on these days. Separate dates with commas, like 2026-12-25, 2026-12-26.">
        <Textarea id={`${fid}-closed`} name="closedDates" rows={3} defaultValue={site.closedDates.join(", ")} />
      </Field>
    </FormDialog>
  );
}
