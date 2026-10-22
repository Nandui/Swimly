"use client";

import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { formatDateTime } from "@/lib/format";
import { MAX_WELLBEING_TO } from "@/modules/incidents/features/wellbeing/rules";
import { saveWellbeingSettings } from "@/modules/incidents/features/wellbeing/server/actions";

const THEME = "turnfin-docs turnfin-module";

/** Incidents > Settings: who gets wellbeing check requests (owner request, 22
 *  October 2026). A list of addresses he keeps, not a role. */
export function WellbeingSettings({ to, changedByName, changedAt }: { to: string[]; changedByName: string | null; changedAt: Date | null }) {
  const router = useRouter();
  return (
    <section aria-labelledby="inc-set-wb-h" className="pc-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="inc-set-wb-h">Who gets wellbeing check requests</h2>
          <p className="text-sm text-ui-muted-foreground">
            When someone asks HR to check on a person after an incident, the email goes to each of these addresses. They open the link in it to record what they did.
          </p>
        </div>
        <FormDialog portalClassName={THEME} width="sm:max-w-lg"
          trigger={<Button variant="outline" className="min-h-11"><Mail aria-hidden="true" />{to.length ? "Change" : "Add addresses"}</Button>}
          title="Who gets wellbeing check requests"
          description={`Up to ${MAX_WELLBEING_TO} email addresses, such as HR's shared inbox. Leave it empty and nobody can ask for a check.`}
          submitLabel="Save" successMessage="Saved" onSuccess={() => router.refresh()}
          submit={(form) => saveWellbeingSettings(String(form.get("to") ?? ""))}>
          <Field label="Email addresses" htmlFor="inc-set-wb-to" hint="One on each line, or separated by commas.">
            <Textarea id="inc-set-wb-to" name="to" rows={4} maxLength={2600} defaultValue={to.join("\n")} placeholder={"hr@example.com\nname@example.com"} autoComplete="off" />
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
      ) : <p className="text-sm text-ui-muted-foreground">Nobody yet, so wellbeing checks can&rsquo;t be asked for. Add HR&rsquo;s email address.</p>}
      {changedByName && changedAt ? <p className="text-xs text-ui-muted-foreground">Last changed by {changedByName}, {formatDateTime(changedAt)}.</p> : null}
    </section>
  );
}
