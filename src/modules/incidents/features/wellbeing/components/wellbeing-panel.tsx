"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCheck, CircleSlash, Clock, FileText, HeartHandshake, Lock, Mail, RotateCw, Send, Settings } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { HR_FOLLOW_UPS, HR_REQUEST_KINDS, WELLBEING_LINK_DAYS, type HrFollowUp, type HrRequestKind, type WellbeingState } from "@/modules/incidents/features/wellbeing/rules";
import { cancelWellbeing, requestWellbeingCheck, sendWellbeingCheckAgain } from "@/modules/incidents/features/wellbeing/server/actions";
import type { WellbeingOnReport } from "@/modules/incidents/features/wellbeing/server/requests";

const THEME = "turnfin-docs turnfin-module";
const text = (data: FormData, key: string) => String(data.get(key) ?? "");

/** Each check's state: its words, tone and icon. */
const CHECK_STATES = {
  waiting: { label: "Waiting for HR", color: "blue", icon: Clock },
  following: { label: "HR following up", color: "orange", icon: HeartHandshake },
  done: { label: "Done", color: "green", icon: CheckCheck },
  expired: { label: "Link expired", color: "gray", icon: CircleSlash },
  cancelled: { label: "Cancelled", color: "gray", icon: Ban },
} satisfies Record<WellbeingState, StatusMeta>;

type Check = WellbeingOnReport["checks"][number];
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** Asking HR on a report (docs/incidents.md, "Asking HR"): by email, to check on
 *  someone's wellbeing, or to let HR know a staff member was in the incident; HR
 *  records what they did through the link. For those who triage at the site;
 *  what HR wrote only for Manage and whoever asked. */
export function WellbeingPanel({ reportId, data }: { reportId: string; data: WellbeingOnReport }) {
  const { checks, canRequest, recipients } = data;
  if (!checks.length && !canRequest) return null;
  return (
    <section aria-labelledby="inc-wellbeing-h" className="pc-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="inc-wellbeing-h">Ask HR</h2>
          <p className="text-sm text-ui-muted-foreground">
            Ask HR to check on someone after what happened, or let HR know a staff member was in it. HR gets an email with a link, records what they did and when, and says what happens next.
          </p>
        </div>
        {canRequest && recipients.length ? <RequestCheck reportId={reportId} data={data} /> : null}
      </div>
      {canRequest && !recipients.length ? (
        <Notice tone="warning" title="Nobody is set to get requests to HR yet"
          description={data.settings ? "Add HR's email address in Settings, then ask from here." : "Someone with Incidents: Manage adds HR's email address in Incidents › Settings."}
          actions={data.settings ? <Button asChild variant="outline" className="min-h-11"><Link href="/incidents/settings"><Settings aria-hidden="true" />Settings</Link></Button> : undefined} />
      ) : null}
      {checks.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nothing sent to HR yet.</p> : (
        <ul className="flex flex-col gap-3">
          {checks.map((c) => <CheckRow key={c.id} check={c} canChange={data.canChange} />)}
        </ul>
      )}
    </section>
  );
}

function RequestCheck({ reportId, data }: { reportId: string; data: WellbeingOnReport }) {
  const router = useRouter();
  const first = data.staff.find((p) => p.involved)?.id ?? "";
  const [kind, setKind] = useState<HrRequestKind>("wellbeing");
  const [who, setWho] = useState(first);
  const inform = kind === "inform";
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={<Button variant="outline" className="min-h-11"><HeartHandshake aria-hidden="true" />Ask HR</Button>}
      title="Ask HR"
      description={`HR gets an email with a link, open for ${WELLBEING_LINK_DAYS} days. It shows who it is about and what you write here${inform ? ", and what happened if you tick it" : ""}. Nothing else of the report.`}
      submitLabel="Send to HR" successMessage="Sent to HR" onOpen={() => { setKind("wellbeing"); setWho(first); }} onSuccess={() => router.refresh()}
      submit={(form) => requestWellbeingCheck(reportId, {
        kind, userId: who, name: text(form, "name"), reason: text(form, "reason"),
        followUps: inform ? form.getAll("followUps").map(String) as HrFollowUp[] : [], shareReport: inform && form.get("shareReport") === "on",
      })}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">What do you need from HR</legend>
        <RadioGroup value={kind} onValueChange={(v) => setKind(v as HrRequestKind)} className="gap-2">
          {(Object.keys(HR_REQUEST_KINDS) as HrRequestKind[]).map((k) => (
            <ChoiceRow key={k} type="radio" id={`inc-wb-kind-${k}`} value={k} title={HR_REQUEST_KINDS[k].ask} hint={HR_REQUEST_KINDS[k].hint} />
          ))}
        </RadioGroup>
      </fieldset>
      <Field label={inform ? "Which staff member" : "Who should HR check on"} htmlFor="inc-wb-who">
        <NativeSelect id="inc-wb-who" value={who} onChange={(e) => setWho(e.target.value)}>
          <NativeSelectOption value="">Someone else: type their name</NativeSelectOption>
          {data.staff.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>{[p.name, p.jobTitle, p.involved ? "named on this report" : null].filter(Boolean).join(", ")}</NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {who ? null : <Field label="Their name" htmlFor="inc-wb-name"><Input id="inc-wb-name" name="name" required minLength={2} maxLength={200} autoComplete="off" /></Field>}
      <Field label={inform ? "What HR should know" : "Why a check is needed"} htmlFor="inc-wb-reason"
        hint={inform ? "A sentence or two, such as how they were involved and how they are now. Leave out medical details: HR will ask them." : "A sentence or two, such as what they went through. Leave out medical details: HR will ask them."}>
        <Textarea id="inc-wb-reason" name="reason" rows={4} required minLength={10} maxLength={2000} />
      </Field>
      {inform ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">What HR may need to follow up</legend>
            <p className="text-xs text-ui-muted-foreground">Tick any that might apply. HR decides.</p>
            <div className="flex flex-col gap-2">
              {(Object.keys(HR_FOLLOW_UPS) as HrFollowUp[]).map((k) => (
                <ChoiceRow key={k} type="checkbox" id={`inc-wb-fu-${k}`} name="followUps" value={k} title={HR_FOLLOW_UPS[k]} />
              ))}
            </div>
          </fieldset>
          <ChoiceRow type="checkbox" id="inc-wb-share" name="shareReport" defaultChecked title="Show HR what happened"
            hint="What happened, as written on the report, and this person's injury if they were hurt. Untick to send only what you write here." />
        </>
      ) : null}
      <p className="text-sm text-ui-muted-foreground">It goes to {data.recipients.join(", ")}, copied to {[...data.copies, "you"].join(", ")}.</p>
    </FormDialog>
  );
}

function CheckRow({ check: c, canChange }: { check: Check; canChange: boolean }) {
  const router = useRouter();
  const meta = CHECK_STATES[c.state];
  const live = c.state === "waiting" || c.state === "following";
  return (
    <li className="flex flex-col gap-3 rounded-card border border-ui-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{c.kind === "inform" ? `Staff member in the incident: ${c.personName}` : `Wellbeing check for ${c.personName}`}</p>
          <p className="text-sm whitespace-pre-line">{c.reason}</p>
          {c.followUps.length ? <p className="text-sm"><span className="font-semibold">HR may need to follow up: </span>{c.followUps.join(", ")}.</p> : null}
          {c.shareReport ? <p className="text-xs text-ui-muted-foreground"><FileText aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />HR can read what happened, as written on the report.</p> : null}
          <p className="text-xs text-ui-muted-foreground">
            Asked by {c.requestedByName}, {formatDateTime(c.createdAt)}. Sent to <span className="break-all">{c.sentTo}</span>.
            {live ? ` The link works until ${formatDate(c.expiresAt)}.` : c.state === "cancelled" && c.cancelledByName ? ` Cancelled by ${c.cancelledByName}.` : ""}
          </p>
        </div>
        <Tag meta={meta} />
      </div>
      {c.emailError && live ? <Notice tone="error" title="The email didn't go" description={`${c.emailError} Use Send again, or call HR.`} /> : null}
      {c.updateCount === 0 ? (
        live ? <p className="text-sm text-ui-muted-foreground"><Mail aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />Waiting for HR to record what they did.</p> : null
      ) : c.readable ? (
        <ol className="flex flex-col gap-3">
          {c.updates.map((u) => (
            <li key={u.id} className="pc-note flex-col items-start gap-1">
              <p className="text-sm font-semibold">{u.byName}, on {day(u.doneOn)}</p>
              <p className="text-sm whitespace-pre-line">{u.whatDone}</p>
              <p className="text-sm whitespace-pre-line"><span className="font-semibold">What happens now: </span>{u.finished ? "Nothing more is needed." : u.nextSteps}</p>
              <p className="text-xs text-ui-muted-foreground">Recorded {formatDateTime(u.createdAt)}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ui-muted-foreground">
          <Lock aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
          {c.updateCount === 1 ? `HR recorded an update on ${formatDateTime(c.lastUpdateAt!)}.` : `HR recorded ${c.updateCount} updates, the last on ${formatDateTime(c.lastUpdateAt!)}.`} What HR wrote is private: only Incidents: Manage and {c.requestedByName} read it.
        </p>
      )}
      {canChange && c.state !== "done" ? (
        <div className="flex flex-wrap gap-2">
          <FormDialog portalClassName={THEME}
            trigger={<Button type="button" variant="outline" className="min-h-11">{live ? <Send aria-hidden="true" /> : <RotateCw aria-hidden="true" />}Send again</Button>}
            title="Send the request to HR again?" description={`HR gets a new link, open for ${WELLBEING_LINK_DAYS} days, at the addresses in Settings now. The old link stops working.`}
            submitLabel="Send it" successMessage="Sent to HR again" onSuccess={() => router.refresh()}
            submit={() => sendWellbeingCheckAgain(c.id)}>{null}</FormDialog>
          {live ? (
            <FormDialog portalClassName={THEME}
              trigger={<Button type="button" variant="ghost" className="min-h-11"><Ban aria-hidden="true" />Cancel the request</Button>}
              title="Cancel this request to HR?" description="Use it if it was sent by mistake or is no longer needed. The link stops working; anything HR recorded stays."
              submitLabel="Cancel the request" destructive cancelLabel="Keep it" successMessage="Request cancelled" onSuccess={() => router.refresh()}
              submit={() => cancelWellbeing(c.id)}>{null}</FormDialog>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
