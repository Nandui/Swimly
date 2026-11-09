"use client";

import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { formatDateTime } from "@/lib/format";
import { MAX_DIGEST_TO } from "@/modules/hr/features/digest/rules";
import { saveDigestSettings } from "@/modules/hr/features/digest/server/actions";

const THEME = "turnfin-docs turnfin-module";

type Last = { day: string; reports: number; sentTo: string; error: string | null } | null;

/** HR > Settings: who gets the daily email of yesterday's reports (owner
 *  request, 9 November 2026). A list of addresses, not a role. */
export function DigestSettings({ to, changedByName, changedAt, last }: { to: string[]; changedByName: string | null; changedAt: Date | null; last: Last }) {
  const router = useRouter();
  return (
    <section aria-labelledby="hr-set-digest-h" className="pc-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="hr-set-digest-h">Daily email of yesterday&rsquo;s reports</h2>
          <p className="text-sm text-ui-muted-foreground">
            Early every morning (7am in winter, 8am in summer), each of these addresses gets every good work and issue report filed the day before, by person, with what was written and a link to their HR file. Nothing is sent on a day with no reports.
          </p>
        </div>
        <FormDialog portalClassName={THEME} width="sm:max-w-lg"
          trigger={<Button variant="outline" className="min-h-11"><Mail aria-hidden="true" />{to.length ? "Change" : "Add addresses"}</Button>}
          title="Daily email of yesterday's reports"
          description={`Up to ${MAX_DIGEST_TO} email addresses. The email carries each report in full, so add only people who may read every HR report. Leave it empty to stop the email.`}
          submitLabel="Save" successMessage="Saved" onSuccess={() => router.refresh()}
          submit={(form) => saveDigestSettings(String(form.get("to") ?? ""))}>
          <Field label="Email addresses" htmlFor="hr-set-digest-to" hint="One on each line, or separated by commas.">
            <Textarea id="hr-set-digest-to" name="to" rows={4} maxLength={2600} defaultValue={to.join("\n")} placeholder={"you@example.com\nname@example.com"} autoComplete="off" />
          </Field>
        </FormDialog>
      </div>
      {to.length ? (
        <ul className="pc-rows">
          {to.map((a) => (
            <li key={a} className="pc-row">
              <Mail aria-hidden="true" className="size-5 shrink-0 text-ui-muted-foreground" />
              <span className="pc-row-body"><span className="pc-row-title break-all">{a}</span></span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-ui-muted-foreground">Nobody yet, so no daily email is sent. Add your email address.</p>}
      {last ? (
        <p className="text-sm text-ui-muted-foreground">
          {last.error ? `Reports for ${last.day} could not all be sent: ${last.error}`
            : last.reports ? `Reports for ${last.day} (${last.reports}) went to ${last.sentTo}.`
            : `No reports were filed on ${last.day}, so nothing was sent.`}
        </p>
      ) : null}
      {changedByName && changedAt ? <p className="text-xs text-ui-muted-foreground">Last changed by {changedByName}, {formatDateTime(changedAt)}.</p> : null}
    </section>
  );
}
