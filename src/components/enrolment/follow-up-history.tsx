"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQueueOpened } from "./queue-disclosure";
import { useRouter } from "next/navigation";
import { History, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/shadcn/sheet";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { addFollowUp, getFollowUpHistory } from "@/lib/enrolment/actions/follow-up";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, type ContactChannel, type ContactOutcome, type FollowUpHistory as HistoryData, type FollowUpSummary } from "@/lib/enrolment/follow-up";
import { formatDate, formatDateTime, parseDateOnly, today } from "@/lib/format";

export function FollowUpHistory({ studentId, name, canRecord, summary, presentation = "default" }: { studentId: string; name: string; canRecord: boolean; summary?: FollowUpSummary; presentation?: "default" | "queue" }) {
  const router = useRouter(), id = useId();
  const [open, setOpen] = useState(false), [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [adding, setAdding] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('PHONE'), [outcome, setOutcome] = useState<ContactOutcome>('CONTACTED');
  const [note, setNote] = useState(''), [occurredOn, setOccurredOn] = useState(today), [nextContactOn, setNextContactOn] = useState('');
  const dirty = useRef(false), operation = useRef<{ key: string; id: string } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const latestSummary = (data?.summary.latest?.sequence ?? 0) >= (summary?.latest?.sequence ?? 0) ? data?.summary ?? summary : summary;
  const latest = latestSummary?.latest;
  const due = latest?.nextContactOn;
  const onQueueOpened = useQueueOpened();

  const load = useCallback(async (before?: number) => {
    setLoading(true); setError('');
    try {
      const result = await getFollowUpHistory(studentId, before);
      setData(previous => before && previous ? { ...result, entries: [...previous.entries, ...result.entries.filter(entry => !previous.entries.some(old => old.id === entry.id))] } : result);
      if (!before && !dirty.current) {
        setOutcome(result.summary.latest?.outcome ?? 'CONTACTED');
        const next = result.summary.latest?.nextContactOn;
        setNextContactOn(next && next >= today() ? next : '');
      }
    } catch { setError('Could not load the follow-up history. Your entries are still here; try reloading.'); }
    finally { setLoading(false); }
  }, [studentId]);
  useEffect(() => {
    if (presentation === 'queue') return onQueueOpened(() => { void load(); });
  }, [onQueueOpened, load, presentation]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;
    const form = new FormData(event.currentTarget);
    const fields = { channel, outcome, note: String(form.get('note') ?? note), occurredOn: String(form.get('occurredOn') ?? occurredOn), nextContactOn: String(form.get('nextContactOn') ?? nextContactOn) };
    setNote(fields.note); setOccurredOn(fields.occurredOn); setNextContactOn(fields.nextContactOn);
    const payload = { studentId, expectedLatest: data.summary.latest?.sequence ?? null, ...fields };
    const key = JSON.stringify(payload);
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setSaving(true); setError(''); setSaved('');
    try {
      const result = await addFollowUp({ ...payload, operationId: operation.current.id });
      if (!result.ok) { setError(result.error); return; }
      operation.current = null; dirty.current = false; setNote(''); setAdding(false); setSaved('Update saved to the swimmer’s history.');
      await load(); router.refresh();
    } catch { setError('Could not confirm the save. Your entries are still here. Try again; the same update will not be recorded twice.'); }
    finally { setSaving(false); }
  }
  const change = <T,>(setter: (value: T) => void) => (value: T) => { dirty.current = true; setSaved(''); setter(value); };
  const panel = <div className={presentation === "queue" ? "space-y-4" : "min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canRecord && <Button disabled={loading || saving || !data} className="min-h-11" onClick={() => { setAdding(true); setSaved(''); }}><Plus aria-hidden="true" />Add contact or note</Button>}
            <Button variant="ghost" className="min-h-11" disabled={loading || saving} onClick={() => void load()}><RefreshCw aria-hidden="true" />Reload history</Button>
          </div>
          {error && <Notice tone="error" title={error} />}
          {saved && <p className="text-sm text-ui-muted-foreground" role="status">{saved}</p>}
          {adding && canRecord && <form onSubmit={save} className="space-y-4 rounded-ui-lg border border-ui-border bg-ui-muted/30 p-4">
            <h3 className="font-semibold">Record contact or work completed</h3>
            <p className="text-sm text-ui-muted-foreground">Log a call, message or class search. Saving does not contact the parent or change their enrolment.</p>
            <fieldset disabled={saving || loading} className="min-w-0 space-y-4">
              <legend className="sr-only">Follow-up details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor={`${id}-channel`}>How</Label><Select value={channel} onValueChange={value => change(setChannel)(value as ContactChannel)}><SelectTrigger id={`${id}-channel`} className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CONTACT_CHANNELS).map(([key, label]) => <SelectItem key={key} value={key} className="min-h-11">{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor={`${id}-date`}>Contact / work date</Label><Input id={`${id}-date`} name="occurredOn" type="date" className="min-h-11" max={today()} value={occurredOn} onChange={event => change(setOccurredOn)(event.target.value)} required /></div>
              </div>
              <div className="space-y-2"><Label htmlFor={`${id}-outcome`}>Current outcome</Label><Select value={outcome} onValueChange={value => change(setOutcome)(value as ContactOutcome)}><SelectTrigger id={`${id}-outcome`} className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CONTACT_OUTCOMES).map(([key, meta]) => <SelectItem key={key} value={key} className="min-h-11">{meta.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor={`${id}-note`}>What happened?</Label><Textarea id={`${id}-note`} name="note" required maxLength={3000} rows={4} value={note} onChange={event => change(setNote)(event.target.value)} placeholder="What did you discuss or check, and what needs to happen next?" /></div>
              <div className="space-y-2"><Label htmlFor={`${id}-next`}>Next follow-up (optional)</Label><Input id={`${id}-next`} name="nextContactOn" type="date" className="min-h-11" min={occurredOn} value={nextContactOn} onChange={event => change(setNextContactOn)(event.target.value)} /><p className="text-xs text-ui-muted-foreground">Leave blank to clear the previous follow-up date. No automatic message is sent.</p></div>
              <p className="text-xs text-ui-muted-foreground">Saved updates stay in the history. Add a new update to correct an earlier entry.</p>
              <div className="flex flex-wrap gap-2"><LoadingButton pending={saving} type="submit" className="min-h-11">Save update</LoadingButton><Button variant="ghost" type="button" className="min-h-11" onClick={() => setAdding(false)}>Hide form</Button></div>
              <p className="text-xs text-ui-muted-foreground">Unsaved text is kept while you stay on this page.</p>
            </fieldset>
          </form>}
          <section className="space-y-4" aria-label="Recorded follow-ups">
            <p className="text-xs text-ui-muted-foreground">Newest recorded first · Calls, messages and internal notes</p>
            {loading && <p role="status" className="text-sm text-ui-muted-foreground">Loading history…</p>}
            {!loading && data && !data.entries.length && <p className="text-sm text-ui-muted-foreground">No follow-ups recorded yet.{canRecord ? ' Add the first update so colleagues know what has been done.' : ' Reception updates will appear here.'}</p>}
            <ol className={presentation === 'queue' ? 'space-y-4' : 'divide-y divide-ui-border'}>{data?.entries.map(entry => <li key={entry.id} className={presentation === 'queue' ? 'space-y-3 rounded-ui-md border border-ui-border bg-ui-muted/30 p-4' : 'space-y-3 py-5 first:pt-0'}>
              <div className="flex flex-wrap items-center justify-between gap-2"><Tag color={CONTACT_OUTCOMES[entry.outcome].color}>{CONTACT_OUTCOMES[entry.outcome].label}</Tag><time className="text-xs text-ui-muted-foreground" dateTime={entry.occurredOn}>{formatDate(parseDateOnly(entry.occurredOn))}</time></div>
              <p className="text-sm font-medium">{CONTACT_CHANNELS[entry.channel]} · {entry.actorName}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.note}</p>
              <p className="text-xs text-ui-muted-foreground">{entry.nextContactOn ? `Next follow-up: ${formatDate(parseDateOnly(entry.nextContactOn))}` : 'No follow-up date set'}<br />Recorded {formatDateTime(new Date(entry.createdAt))} · {entry.clubName}</p>
            </li>)}</ol>
            {data?.nextBefore && <Button variant="outline" className="min-h-11" disabled={loading || saving} onClick={() => void load(data.nextBefore!)}>Load earlier updates</Button>}
          </section>
        </div>;
  if (presentation === "queue") return <section aria-label={`Contact history for ${name}`} className="min-w-0 space-y-4"><div><h3 className="font-semibold">Contact history & notes{latestSummary?.count ? ` (${latestSummary.count})` : ""}</h3><p className="text-xs text-ui-muted-foreground">Shared with colleagues across both sites. Staff only.</p></div>{panel}</section>;
  return <div className="space-y-2">
    {summary && <div className="space-y-1 text-sm">
      {latest ? <><Tag color={CONTACT_OUTCOMES[latest.outcome].color}>{CONTACT_OUTCOMES[latest.outcome].label}</Tag>
        {due ? <p className="text-xs font-medium">{due < today() ? 'Follow-up overdue' : due === today() ? 'Follow up today' : 'Next follow-up'} · {formatDate(parseDateOnly(due))}</p> : <p className="text-xs text-ui-muted-foreground">No follow-up date set</p>}
        <p className="text-xs text-ui-muted-foreground">Recorded {formatDateTime(new Date(latest.createdAt))} · {latest.actorName}</p>
      </> : <p className="text-ui-muted-foreground">No follow-up recorded</p>}
    </div>}
    <Sheet open={open} onOpenChange={value => { if (saving) return; setOpen(value); if (value) void load(); }}>
      <div className="flex flex-wrap gap-2">
        <SheetTrigger asChild><Button variant="outline" className="min-h-11" aria-label={`Follow-up history for ${name}`} onClick={event => { trigger.current = event.currentTarget; }}><History className="size-4" aria-hidden="true" />Follow-up history{latestSummary?.count ? ` (${latestSummary.count})` : ''}</Button></SheetTrigger>
      </div>
      <SheetContent onCloseAutoFocus={event => { if (trigger.current) { event.preventDefault(); trigger.current.focus(); } }} className="w-full gap-0 sm:max-w-2xl [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center">
        <SheetHeader className="shrink-0 border-b border-ui-border p-4 pr-16 sm:p-6 sm:pr-16"><SheetTitle className="text-xl">Follow-up history</SheetTitle><SheetDescription><span className="font-medium text-ui-foreground">{name}</span><br />Shared across both sites, enrolments and moves. These notes are for staff only.</SheetDescription></SheetHeader>
        {panel}
      </SheetContent>
    </Sheet>
  </div>;
}
