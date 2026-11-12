"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleSlash, ClipboardList, PencilLine, RotateCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { AreaSelect } from "@/components/ui/area-select";
import { ChoiceRow } from "@/components/ui/choice-row";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { correctRequest, moveRequest } from "@/modules/maintenance/features/requests/server/actions";
import { MAINTENANCE_URGENCY_META, maintenanceNumber, RISK_LABEL, RISKS, TRACKPLAN_ANSWERS, TRACKPLAN_LABEL, URGENCIES, type MaintenanceView, type Move, type Risk, type TrackplanAnswer, type Urgency } from "@/modules/maintenance/shared/types";

type Candidate = { id: string; number: number; title: string; area: string };
const LABEL: Record<Move, string> = { trackplan: "Put in Trackplan", fix: "Mark fixed", close: "Close, not fixed", reopen: "Open again" };
const ICON: Record<Move, LucideIcon> = { trackplan: ClipboardList, fix: CircleCheck, close: CircleSlash, reopen: RotateCcw };
const SAYS: Record<Move, string> = {
  trackplan: "Record that it is now in Trackplan. Put it there first: Turnfin does not send it.",
  fix: "Record that it has been put right. It leaves the open list; it can be opened again.",
  close: "Close it without a fix: reported twice, no longer needed, or replaced.",
  reopen: "Open it again, for example when the fix did not last.",
};
const DONE: Record<Move, string> = { trackplan: "Marked as in Trackplan", fix: "Marked fixed", close: "Closed, not fixed", reopen: "Opened again" };

/** Manage's moves on a request, beside it in "Next action": the buttons for where it is now, each
 *  with a short dialog, and Correct details. The first button is the one prominent action. */
export function ManageActions({ request, candidates, areas }: { request: MaintenanceView; candidates: Candidate[]; areas: string[] }) {
  const router = useRouter();
  const [move, setMove] = useState<Move | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const operation = useRef("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [closeAs, setCloseAs] = useState<"reason" | "duplicate">("reason");
  const moves: Move[] = request.status === "reported" ? ["trackplan", "fix", "close"] : request.status === "in_trackplan" ? ["fix", "close"] : ["reopen"];

  function open(next: Move | "correct", button: HTMLButtonElement) {
    trigger.current = button; operation.current = crypto.randomUUID(); setError(null); setCloseAs("reason");
    if (next === "correct") setCorrecting(true); else setMove(next);
  }
  function done(message: string) { setMove(null); setCorrecting(false); toast.success(message); router.refresh(); }

  function sendMove(form: HTMLFormElement) {
    if (!move) return;
    const v = new FormData(form);
    start(async () => {
      const result = await moveRequest({
        id: request.id, operationId: operation.current, version: request.version, move,
        note: String(v.get("note") ?? ""), trackplanRef: String(v.get("trackplanRef") ?? ""), duplicateOfId: closeAs === "duplicate" ? String(v.get("duplicateOfId") ?? "") : "",
      });
      if (!result.ok) { setError(result.error); return; }
      done(DONE[move]);
    });
  }
  function sendCorrection(form: HTMLFormElement) {
    const v = new FormData(form);
    start(async () => {
      const result = await correctRequest({
        id: request.id, operationId: operation.current, version: request.version,
        area: String(v.get("area") ?? ""), place: String(v.get("place") ?? ""), title: String(v.get("title") ?? ""), details: String(v.get("details") ?? ""),
        urgency: String(v.get("urgency") ?? request.urgency) as Urgency, risk: String(v.get("risk") ?? request.risk) as Risk,
        trackplan: String(v.get("trackplan") ?? request.trackplan) as TrackplanAnswer, trackplanRef: String(v.get("trackplanRef") ?? ""),
      });
      if (!result.ok) { setError(result.error); return; }
      done("Details corrected");
    });
  }
  const back = (event: Event) => { event.preventDefault(); trigger.current?.focus(); };
  const Icon = move ? ICON[move] : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {moves.map((m, i) => {
          const MoveIcon = ICON[m];
          return <Button key={m} className="justify-start" variant={i === 0 ? "default" : "outline"} disabled={pending} onClick={(e) => open(m, e.currentTarget)}><MoveIcon aria-hidden="true" />{LABEL[m]}</Button>;
        })}
        <Button className="justify-start" variant="ghost" disabled={pending} onClick={(e) => open("correct", e.currentTarget)}><PencilLine aria-hidden="true" />Correct details</Button>
      </div>

      <Dialog open={!!move} onOpenChange={(o) => { if (!o && !pending) setMove(null); }}>
        <DialogContent onCloseAutoFocus={back} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader><DialogTitle>{move ? LABEL[move] : ""}</DialogTitle><DialogDescription>{move ? SAYS[move] : ""}</DialogDescription></DialogHeader>
          <form method="post" onSubmit={(e) => { e.preventDefault(); sendMove(e.currentTarget); }} className="space-y-4">
            <fieldset disabled={pending} className="space-y-4">
              {move === "trackplan" ? (
                <Field label="Trackplan reference" htmlFor="mnt-move-ref" hint="The job number in Trackplan" optional>
                  <Input id="mnt-move-ref" name="trackplanRef" defaultValue={request.trackplanRef} maxLength={60} autoComplete="off" />
                </Field>
              ) : null}
              {move === "close" && candidates.length ? (
                <RadioGroup value={closeAs} onValueChange={(v) => setCloseAs(v as "reason" | "duplicate")} className="gap-2" aria-label="Why it is closed">
                  <ChoiceRow type="radio" id="mnt-close-reason" value="reason" title="Not needed or replaced" hint="Say why below" />
                  <ChoiceRow type="radio" id="mnt-close-duplicate" value="duplicate" title="Reported twice" hint="Point to the request it repeats" />
                </RadioGroup>
              ) : null}
              {move === "close" && closeAs === "duplicate" ? (
                <Field label="The request it repeats" htmlFor="mnt-dup">
                  <NativeSelect id="mnt-dup" name="duplicateOfId" required className="min-h-11 w-full" defaultValue="">
                    <NativeSelectOption value="" disabled>Choose a request</NativeSelectOption>
                    {candidates.map((c) => <NativeSelectOption key={c.id} value={c.id}>{`${maintenanceNumber(c.number)} · ${c.title}${c.area ? ` (${c.area})` : ""}`}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              ) : null}
              {move ? (
                <Field label={move === "fix" ? "What was done" : move === "close" ? (closeAs === "duplicate" ? "Note" : "Why it is closed") : move === "reopen" ? "Why it is open again" : "Note"} htmlFor="mnt-move-note" optional={move !== "close" || closeAs === "duplicate"}>
                  <Textarea id="mnt-move-note" name="note" rows={3} maxLength={1000} required={move === "close" && closeAs === "reason"} placeholder={move === "fix" ? "For example: bulb replaced by the maintenance team" : undefined} />
                </Field>
              ) : null}
              {error ? <Notice tone="error" live="alert" title={error} /> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMove(null)}>Go back</Button>
                <LoadingButton type="submit" pending={pending} pendingLabel="Saving…">{Icon ? <Icon aria-hidden="true" /> : null}{move ? LABEL[move] : ""}</LoadingButton>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={correcting} onOpenChange={(o) => { if (!o && !pending) setCorrecting(false); }}>
        <DialogContent onCloseAutoFocus={back} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader><DialogTitle>Correct details</DialogTitle><DialogDescription>Fix what was reported. The history keeps what changed and who changed it.</DialogDescription></DialogHeader>
          <CorrectForm request={request} areas={areas} pending={pending} error={error} onCancel={() => setCorrecting(false)} onSend={sendCorrection} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CorrectForm({ request, areas, pending, error, onCancel, onSend }: { request: MaintenanceView; areas: string[]; pending: boolean; error: string | null; onCancel(): void; onSend(form: HTMLFormElement): void }) {
  const [risk, setRisk] = useState<Risk>(request.risk);
  const [urgency, setUrgency] = useState<Urgency>(request.urgency);
  const [trackplan, setTrackplan] = useState<TrackplanAnswer>(request.trackplan);
  return (
    <form method="post" onSubmit={(e) => { e.preventDefault(); onSend(e.currentTarget); }} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <Field label="Area" htmlFor="mnt-c-area" optional><AreaSelect id="mnt-c-area" name="area" areas={areas} defaultValue={request.area} emptyLabel="Not in one area" /></Field>
        <Field label="Exactly where" htmlFor="mnt-c-place" optional><Input id="mnt-c-place" name="place" defaultValue={request.place} maxLength={200} /></Field>
        <Field label="What is broken" htmlFor="mnt-c-title"><Input id="mnt-c-title" name="title" defaultValue={request.title} maxLength={160} required /></Field>
        <Field label="Details" htmlFor="mnt-c-details" optional><Textarea id="mnt-c-details" name="details" defaultValue={request.details} rows={3} maxLength={4000} /></Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Is it out of use, or could it hurt someone?</legend>
          <RadioGroup name="risk" value={risk} onValueChange={(v) => setRisk(v as Risk)} className="gap-2">
            {RISKS.map((r) => <ChoiceRow key={r} type="radio" id={`mnt-c-risk-${r}`} value={r} title={RISK_LABEL[r]} />)}
          </RadioGroup>
        </fieldset>
        <div className="space-y-2">
          <p id="mnt-c-urgency" className="text-sm font-semibold">How urgent</p>
          <SegmentedChoice name="urgency" aria-labelledby="mnt-c-urgency" fill="phone" value={risk === "could_hurt" ? "urgent" : urgency} onValueChange={(v) => setUrgency(v as Urgency)} disabled={risk === "could_hurt"}
            options={URGENCIES.map((u) => ({ value: u, label: MAINTENANCE_URGENCY_META[u].label }))} />
          {risk === "could_hurt" ? <input type="hidden" name="urgency" value="urgent" /> : null}
        </div>
        <div className="space-y-2">
          <p id="mnt-c-trackplan" className="text-sm font-semibold">Is it in Trackplan?</p>
          <SegmentedChoice name="trackplan" aria-labelledby="mnt-c-trackplan" fill="phone" value={trackplan} onValueChange={(v) => setTrackplan(v as TrackplanAnswer)} options={TRACKPLAN_ANSWERS.map((a) => ({ value: a, label: TRACKPLAN_LABEL[a] }))} />
        </div>
        {trackplan === "yes" ? <Field label="Trackplan reference" htmlFor="mnt-c-ref" optional><Input id="mnt-c-ref" name="trackplanRef" defaultValue={request.trackplanRef} maxLength={60} autoComplete="off" /></Field> : null}
        {error ? <Notice tone="error" live="alert" title={error} /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Go back</Button>
          <LoadingButton type="submit" pending={pending} pendingLabel="Saving…">Save changes</LoadingButton>
        </DialogFooter>
      </fieldset>
    </form>
  );
}
