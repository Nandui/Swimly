"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { formatDateTime } from "@/lib/format";
import { linkReportHazards, searchReportHazards, unlinkReportHazard } from "@/modules/incidents/features/hazards/server/actions";
import type { HazardsOnReport } from "@/modules/incidents/features/hazards/server/links";

type Found = Awaited<ReturnType<typeof searchReportHazards>>;

/** The hazards this incident involved, from the site's risk assessments: linked by whoever
 *  triages, so the report and the assessment point at each other, with the choice to ask the
 *  assessment's writers for another look. Each opens its assessment for those who may read it. */
export function HazardsPanel({ reportId, data }: { reportId: string; data: HazardsOnReport }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const remove = (id: string) => start(async () => {
    const result = await unlinkReportHazard(id);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success("Link removed"); router.refresh();
  });
  return (
    <section aria-labelledby="inc-hazards-h" className="pc-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="inc-hazards-h">Hazards involved</h2>
          <p className="text-sm text-ui-muted-foreground">Link the hazards from this site’s risk assessments that played a part, and ask for an assessment to be looked at again if its controls did not hold.</p>
        </div>
        {data.canLink ? <LinkHazards reportId={reportId} area={data.area} /> : null}
      </div>
      {data.links.length === 0 ? <p className="text-sm text-ui-muted-foreground">No hazards linked yet.</p> : (
        <ul className="flex flex-col gap-3">
          {data.links.map((l) => (
            <li key={l.id} className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="font-semibold break-words"><Link href={l.href} className="underline-offset-4 hover:underline">{l.hazard}</Link></p>
                <p className="text-sm text-ui-muted-foreground tabular-nums break-words">{[l.hazardRef, l.assessment, l.reviewAsked ? "Review asked for" : null, `Linked by ${l.addedByName}, ${formatDateTime(l.createdAt)}`].filter(Boolean).join(" · ")}</p>
                {l.note ? <p className="text-sm break-words whitespace-pre-line">{l.note}</p> : null}
              </div>
              {data.canRemove ? <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => remove(l.id)}><Trash2 aria-hidden="true" /><span className="sr-only">{`Remove the link to ${l.hazardRef}`}</span></Button> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinkHazards({ reportId, area }: { reportId: string; area: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [chosen, setChosen] = useState<Found>([]);
  const [askReview, setAskReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const operation = useRef("");
  const asked = useRef(0);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // What matches as the person types; the latest question wins.
  useEffect(() => {
    if (!open) return;
    const ask = ++asked.current;
    const timer = setTimeout(() => {
      searchReportHazards(reportId, q).then((rows) => { if (ask === asked.current) setFound(rows); }, () => { if (ask === asked.current) setFound([]); });
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, q, reportId]);

  function show() {
    operation.current = crypto.randomUUID(); setQ(""); setFound(null); setChosen([]); setAskReview(false); setError(null); setOpen(true);
  }
  const toggle = (hazard: Found[number], on: boolean) => setChosen((now) => (on ? [...now.filter((h) => h.id !== hazard.id), hazard] : now.filter((h) => h.id !== hazard.id)));
  function send(form: HTMLFormElement) {
    setError(null);
    if (!chosen.length) return setError("Choose at least one hazard.");
    const note = String(new FormData(form).get("note") ?? "");
    start(async () => {
      const result = await linkReportHazards(reportId, { operationId: operation.current, hazardIds: chosen.map((h) => h.id), note, askReview });
      if (!result.ok) { setError(result.error); return; }
      setOpen(false); toast.success(askReview ? "Hazards linked, and a review asked for" : "Hazards linked"); router.refresh();
    });
  }
  // What is ticked stays where it is; a ticked hazard a new search no longer finds is kept on top.
  const shown = [...chosen.filter((c) => !(found ?? []).some((h) => h.id === c.id)), ...(found ?? [])];

  return (
    <>
      <Button ref={trigger} variant="outline" className="min-h-11" onClick={show}><Link2 aria-hidden="true" />Link hazards</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) setOpen(false); }}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Link hazards</DialogTitle>
            <DialogDescription>{`From this site’s risk assessments${area ? `, those for ${area} first` : ""}. Search by the hazard, the area or the assessment’s number.`}</DialogDescription>
          </DialogHeader>
          <form method="post" onSubmit={(e) => { e.preventDefault(); send(e.currentTarget); }} className="space-y-4" noValidate>
            <fieldset disabled={pending} className="space-y-4">
              <Field label="Search" htmlFor="inc-hazard-q">
                <Input id="inc-hazard-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} autoComplete="off" placeholder="For example: wet floor" />
              </Field>
              <fieldset className="space-y-2" aria-busy={found === null}>
                <legend className="text-sm font-semibold">Hazards</legend>
                {found === null ? <p className="text-sm text-ui-muted-foreground" role="status"><Search aria-hidden="true" className="inline size-4" /> Looking…</p> : null}
                {found !== null && shown.length === 0 ? <p className="text-sm text-ui-muted-foreground" role="status">{q ? "No hazard matches. Try other words." : "This site has no hazards on an assessment in use yet."}</p> : null}
                <div className="flex flex-col gap-2">
                  {shown.map((h) => (
                    <ChoiceRow key={h.id} type="checkbox" id={`inc-hazard-${h.id}`} title={h.hazard} hint={`${h.reference} · ${h.assessment} · risk ${h.score}`}
                      checked={chosen.some((c) => c.id === h.id)} onCheckedChange={(on) => toggle(h, on === true)} />
                  ))}
                </div>
              </fieldset>
              <ChoiceRow type="checkbox" id="inc-hazard-review" title="Ask for the assessment to be reviewed" hint="Its writers get a review request with this report’s number and your note. Nobody on the report is named."
                checked={askReview} onCheckedChange={(on) => setAskReview(on === true)} />
              <Field label={askReview ? "What should be looked at again" : "Note"} htmlFor="inc-hazard-note" hint="Keep people’s names out of it" optional>
                <Textarea id="inc-hazard-note" name="note" rows={3} maxLength={1000} />
              </Field>
              {error ? <Notice tone="error" live="alert" title={error} /> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Go back</Button>
                <LoadingButton type="submit" pending={pending} pendingLabel="Saving…"><ShieldCheck aria-hidden="true" />{chosen.length > 1 ? `Link ${chosen.length} hazards` : "Link the hazard"}</LoadingButton>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
