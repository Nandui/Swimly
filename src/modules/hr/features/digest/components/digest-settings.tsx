"use client";

import { useRouter } from "next/navigation";
import { Building2, Mail } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { formatDateTime } from "@/lib/format";
import { MAX_DIGEST_TO } from "@/modules/hr/features/digest/rules";
import { saveDigestSettings } from "@/modules/hr/features/digest/server/actions";

const THEME = "turnfin-docs turnfin-module";

type Last = { day: string; reports: number; sentTo: string; error: string | null } | null;
type Site = { id: string; name: string; to: string[] };

/** HR > Settings: who gets the daily email of yesterday's reports (owner
 *  requests, 9 November 2026): a list for every site, and one for each site,
 *  chosen by the person's main site. Addresses, not a role. */
export function DigestSettings({ to, sites, changedByName, changedAt, last }: { to: string[]; sites: Site[]; changedByName: string | null; changedAt: Date | null; last: Last }) {
  const router = useRouter();
  const any = to.length > 0 || sites.some((s) => s.to.length > 0);
  return (
    <section aria-labelledby="hr-set-digest-h" className="pc-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="hr-set-digest-h">Daily email of yesterday&rsquo;s reports</h2>
          <p className="text-sm text-ui-muted-foreground">
            Early every morning (7am in winter, 8am in summer), each address gets the good work and issue reports filed the day before, by person, with what was written and a link to their HR file. A site&rsquo;s addresses get the reports on people whose main site it is. Nobody gets an email on a day with nothing for them.
          </p>
        </div>
        <FormDialog portalClassName={THEME} width="sm:max-w-lg"
          trigger={<Button variant="outline" className="min-h-11"><Mail aria-hidden="true" />{any ? "Change" : "Add addresses"}</Button>}
          title="Daily email of yesterday's reports"
          description={`Up to ${MAX_DIGEST_TO} email addresses in each list. The email carries each report in full, so add only people who may read those reports. Leave a list empty to send it to nobody.`}
          submitLabel="Save" successMessage="Saved" onSuccess={() => router.refresh()}
          submit={(form) => saveDigestSettings(String(form.get("to") ?? ""), Object.fromEntries(sites.map((s) => [s.id, String(form.get(`to-${s.id}`) ?? "")])))}>
          <Field label="Every site" htmlFor="hr-set-digest-to" optional hint="Gets every report, whatever the person's main site. One address on each line, or separated by commas.">
            <Textarea id="hr-set-digest-to" name="to" rows={3} maxLength={2600} defaultValue={to.join("\n")} placeholder={"you@example.com"} autoComplete="off" />
          </Field>
          {sites.map((s) => (
            <Field key={s.id} label={`${s.name} staff`} htmlFor={`hr-set-digest-to-${s.id}`} optional hint={`Gets the reports on people whose main site is ${s.name}, such as its centre manager.`}>
              <Textarea id={`hr-set-digest-to-${s.id}`} name={`to-${s.id}`} rows={2} maxLength={2600} defaultValue={s.to.join("\n")} placeholder="name@example.com" autoComplete="off" />
            </Field>
          ))}
        </FormDialog>
      </div>
      <ul className="pc-rows">
        {[{ id: "every", name: "Every site", to, icon: Mail }, ...sites.map((s) => ({ ...s, name: `${s.name} staff`, icon: Building2 }))].map((s) => (
          <li key={s.id} className="pc-row">
            <s.icon aria-hidden="true" className="size-5 shrink-0 text-ui-muted-foreground" />
            <span className="pc-row-body">
              <span className="pc-row-title">{s.name}</span>
              <span className="pc-row-hint break-all">{s.to.length ? s.to.join(", ") : "Nobody"}</span>
            </span>
          </li>
        ))}
      </ul>
      {!any ? <p className="text-sm text-ui-muted-foreground">Nobody yet, so no daily email is sent. Add your email address.</p> : null}
      <p className="text-sm text-ui-muted-foreground">Someone with no main site set is only in the every-site email.</p>
      {last ? (
        <p className="text-sm text-ui-muted-foreground">
          {last.error ? `Reports for ${last.day} could not all be sent: ${last.error}`
            : last.sentTo ? `Reports for ${last.day} (${last.reports}) went to ${last.sentTo}.`
            : `Nothing was sent for ${last.day}: no reports for anyone on the lists.`}
        </p>
      ) : null}
      {changedByName && changedAt ? <p className="text-xs text-ui-muted-foreground">Last changed by {changedByName}, {formatDateTime(changedAt)}.</p> : null}
    </section>
  );
}
