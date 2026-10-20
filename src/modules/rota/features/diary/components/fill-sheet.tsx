"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Notice } from "@/components/ui-kit/notice";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { clock, parseClock } from "@/modules/rota/shared/constants";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { duration } from "@/modules/rota/shared/shifts";
import { candidates, type Candidate, type Need, type Span } from "@/modules/rota/features/diary/model";
import { fillNeed } from "@/modules/rota/features/diary/server/actions";
import { useDiary } from "@/modules/rota/features/diary/components/context";
import { needWords, span as spanWords } from "@/modules/rota/features/diary/components/words";

export type FillTarget = { needKey: string; span: Span; why: string | null };

/** Choosing who fills a need for a stretch (owner, 20 October 2026: best fits on top, anyone from
 *  another department straight away). Each person says what taking it does to their day. */
export function FillSheet({ target, onClose }: { target: FillTarget | null; onClose: () => void }) {
  const { needs } = useDiary();
  const need = target ? needs.get(target.needKey) ?? null : null;
  return (
    <Sheet open={!!need} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent portalClassName="turnfin-module" className="diary-sheet">
        {need && target ? <FillBody key={`${target.needKey}|${target.span.start}`} need={need} target={target} onDone={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function FillBody({ need, target, onDone }: { need: Need; target: FillTarget; onDone: () => void }) {
  const ctx = useDiary();
  const fixed = need.kind === "class";
  const [from, setFrom] = useState(clock(target.span.start));
  const [to, setTo] = useState(clock(target.span.end));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const s = parseClock(from), e = parseClock(to);
  const valid = !fixed && s !== null && e !== null && e > s;
  const spanStart = valid ? s! : target.span.start, spanEnd = valid ? e! : target.span.end;
  const span = useMemo(() => ({ start: spanStart, end: spanEnd }), [spanStart, spanEnd]);
  const list = useMemo(() => candidates(ctx.diary, ctx.candidateInput, need, span, ctx.hoursMap), [ctx.diary, ctx.candidateInput, ctx.hoursMap, need, span]);
  const best = list.filter((c) => c.ok && c.own);
  const lent = list.filter((c) => c.ok && !c.own);
  const cannot = list.filter((c) => !c.ok);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const who = list.find((c) => c.userId === button?.value);
    if (!who || !ctx.departmentFor) return;
    const change = ctx.live ? changeOf(new FormData(event.currentTarget)) : {};
    setError(null);
    start(async () => {
      const result = await fillNeed({ siteId: ctx.siteId, date: ctx.date, departmentId: ctx.departmentFor!, kind: need.kind, needId: need.needId, classRef: need.classRef,
        userId: who.userId, start: clock(span.start), end: clock(span.end) }, change);
      if (!result.ok) { setError(result.error); return; }
      toast.success(`${who.name} is on ${need.title}, ${spanWords(span)}.`);
      onDone();
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{needWords(need)}</SheetTitle>
        <SheetDescription>{spanWords(target.span)}{target.why ? `: ${target.why.toLowerCase()}` : ""}{need.requiredName ? `. Needs ${need.requiredName}.` : "."}</SheetDescription>
      </SheetHeader>
      <form className="diary-sheet-body" onSubmit={submit} aria-busy={pending}>
        {error ? <Notice tone="error" live="alert" title={error} /> : null}
        {fixed ? <p className="diary-muted">A swim class is taught for its whole time, {spanWords(need)}.</p> : (
          <fieldset className="diary-times">
            <legend className="diary-label">For which part</legend>
            <Input type="time" label="From" step={300} value={from} onChange={setFrom} min={clock(need.start)} max={clock(need.end)} required />
            <Input type="time" label="To" step={300} value={to} onChange={setTo} min={clock(need.start)} max={clock(need.end)} required />
          </fieldset>
        )}
        {ctx.live ? <ChangeFields id="diary-fill" /> : null}
        <Group title="Best fits" hint="Free then, can do it, from this department" people={best} pending={pending} empty="Nobody in this department is free and able then." />
        {lent.length ? <Group title="From other departments" hint="Free then and able: they are lent for this" people={lent} pending={pending} /> : null}
        {cannot.length ? (
          <Collapsible className="diary-cannot">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="diary-cannot-toggle">Can&apos;t do it then ({cannot.length})<ChevronDown aria-hidden="true" /></Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="diary-picks">
                {cannot.map((c) => <li key={c.userId} className="diary-pick" data-off=""><span className="diary-pick-name">{c.name}</span><span className="diary-muted">{c.why}</span></li>)}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </form>
    </>
  );
}

function Group({ title, hint, people, pending, empty }: { title: string; hint: string; people: Candidate[]; pending: boolean; empty?: string }) {
  return (
    <section className="diary-group" aria-label={title}>
      <h3 className="diary-group-title">{title}</h3>
      <p className="diary-muted">{hint}</p>
      {people.length ? (
        <ul className="diary-picks">
          {people.map((c) => (
            <li key={c.userId} className="diary-pick">
              <div className="diary-pick-text">
                <span className="diary-pick-name">{c.name}</span>
                <span className="diary-muted">{c.effect}{c.why ? `. ${c.why}` : ""}</span>
                <span className="diary-caption tabular-nums">{duration(c.weekMinutes)} this week{c.contractMinutes ? ` of ${duration(c.contractMinutes)}` : ""}{c.extraMinutes ? `, ${duration(c.extraMinutes)} more` : ""}</span>
              </div>
              <Button type="submit" name="userId" value={c.userId} disabled={pending}>Put on</Button>
            </li>
          ))}
        </ul>
      ) : <p className="diary-muted">{empty}</p>}
    </section>
  );
}
