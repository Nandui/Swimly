"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { ChoiceRow } from "@/components/ui/choice-row";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { formatDate, formatDateTime } from "@/lib/format";
import { recordWellbeing } from "@/modules/incidents/features/wellbeing/server/actions";
import type { WellbeingLink } from "@/modules/incidents/features/wellbeing/server/hr-link";

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

/** The page HR's emailed link opens (docs/incidents.md, "Wellbeing checks"): who
 *  to check on and why, what HR has recorded so far, and a form for what they
 *  did, when, and what happens next. Nothing else of the report. */
export function RecordWellbeing({ token, link }: { token: string; link: WellbeingLink }) {
  const router = useRouter();
  const [byName, setByName] = useState(link.updates.at(-1)?.byName ?? "");
  const [doneOn, setDoneOn] = useState(link.today);
  const [whatDone, setWhatDone] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    const result = await recordWellbeing({ token, byName, doneOn, whatDone, nextSteps, finished });
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setWhatDone(""); setNextSteps(""); setSaved(true);
    router.refresh();
  }

  return (
    <PageShell spacing="roomy" header={<PageHeader title="Wellbeing check"
      description={`${link.requestedByName} at ${link.site} asked HR for this on ${formatDateTime(link.createdAt)}, after incident ${link.reference} on ${link.occurredOn}.`} />}>

      <div className="pc-note flex-col items-start gap-1">
        <p className="text-sm font-semibold">Who to check on: {link.personName}</p>
        <p className="text-sm whitespace-pre-line">{link.reason}</p>
      </div>

      {link.updates.length ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Recorded so far</h2>
          <ol className="flex flex-col gap-3">
            {link.updates.map((u) => (
              <li key={u.id} className="flex flex-col gap-1 rounded-card border border-ui-border p-4">
                <p className="text-sm font-semibold">{u.byName}, on {day(u.doneOn)}</p>
                <p className="text-sm whitespace-pre-line">{u.whatDone}</p>
                <p className="text-sm whitespace-pre-line"><span className="font-semibold">What happens now: </span>{u.finished ? "Nothing more is needed." : u.nextSteps}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <form onSubmit={save} className="flex flex-col gap-4" aria-labelledby="wb-form-h">
        <h2 id="wb-form-h" className="text-base font-semibold">{link.updates.length ? "Add what you did next" : "Record what you did"}</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wb-by">Your name</Label>
          <Input id="wb-by" value={byName} onChange={(e) => setByName(e.target.value)} required minLength={2} maxLength={200} autoComplete="name" disabled={busy} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wb-on">When you did it</Label>
          <Input id="wb-on" type="date" value={doneOn} onChange={(e) => setDoneOn(e.target.value)} min={link.askedOn} max={link.today} required disabled={busy} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="wb-what">What you did</Label>
          <Textarea id="wb-what" value={whatDone} onChange={(e) => setWhatDone(e.target.value)} rows={4} required minLength={5} maxLength={4000} disabled={busy}
            placeholder="Such as: phoned them at home, they are coping well and were offered the employee assistance line" />
        </div>
        <ChoiceRow type="checkbox" title="Nothing more is needed" hint="This finishes the check and closes this link."
          checked={finished} onCheckedChange={(v) => setFinished(v === true)} disabled={busy} />
        {finished ? null : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="wb-next">What happens now</Label>
            <Textarea id="wb-next" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} rows={3} required maxLength={4000} disabled={busy}
              placeholder="Such as: a return-to-work meeting on Monday, or call again in a week" />
            <p className="text-xs text-ui-muted-foreground">You can come back to this link to add the next step. It stays open for 30 days after each update.</p>
          </div>
        )}
        {error ? <Notice tone="error" live="alert" title={error} /> : null}
        {saved ? <Notice tone="success" live="status" title="Saved. Thank you." description={`${link.requestedByName} gets an email to say it is on the report.`} /> : null}
        <div><LoadingButton type="submit" className="min-h-11" pending={busy} pendingLabel="Saving…">Save</LoadingButton></div>
      </form>

      <p className="text-xs text-ui-muted-foreground">
        What you write is kept with the incident report and read only by the managers who sign off incidents and by {link.requestedByName}. Keep to what they need to know. This link works until {formatDate(link.expiresAt)}; please don&rsquo;t forward it.
      </p>
    </PageShell>
  );
}

/** A link that takes no more updates: say why and who to ask, nothing else. */
export function WellbeingLinkClosed({ problem, askedBy }: { problem: string; askedBy: string | null }) {
  return (
    <PageShell header={<PageHeader title="This link is closed"
      description={`${problem} ${askedBy ? `Reply to the email from ${askedBy} if you need to add something.` : "Reply to the email it came in if you need to add something."}`} />} />
  );
}
