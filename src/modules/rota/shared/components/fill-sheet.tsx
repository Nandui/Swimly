"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Plus, TriangleAlert } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Field } from "@/components/form-dialog";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { assign, handOver, planTeacher, whoCanFill } from "@/modules/rota/shared/actions";
import { clock, parseClock } from "@/modules/rota/shared/constants";
import type { Fit } from "@/modules/rota/shared/fit";
import { ROTA_FIT_META, qualificationShort } from "@/modules/rota/shared/meta";
import { duration } from "@/modules/rota/shared/shifts";
import { toast } from "@/components/ui/toast";

/** One gap to fill: an activity's place for a stretch of time, or a run of swim classes. */
export type GapRef = {
  siteId: string;
  date: string;
  typeId: string;
  /** "Lifeguarding · Main pool". */
  what: string;
  dateLabel: string;
  start: number;
  end: number;
  requiredName: string | null;
  /** A planned activity's place, or null for swim classes. */
  needId: string | null;
  place: number | null;
  /** The classes the gap covers, when it is swim teaching. */
  classRefs: string[];
  /** Who teaches those classes that day now, when someone does: choosing another person changes
   *  it for that day only, and they can be taken off. */
  teacher?: { userId: string; name: string } | null;
  /** The department whose plan it was opened from: a class given to someone goes on their shift there. */
  departmentId?: string;
  /** Covering someone who is off: their place on the activity, swapped to the person chosen. */
  replace: { assignmentId: string | null; name: string } | null;
  /** Handing part of someone's time to another person (owner request, 16 October 2026: staff "in
   *  and out" of an activity): who keeps the rest, and their own time on it (`from`-`to`), which
   *  the cover must stay inside. `start`-`end` is the cover suggested first. */
  handOver?: { assignmentId: string; userId: string; name: string; from: number; to: number } | null;
};

/** The sheet's gap for handing part of someone's time on an activity to another person: the
 *  stretch `cover` when given (their break), else the second hour of a long stint, else all of it. */
export function handOverGap(at: { siteId: string; date: string; dateLabel: string; typeId: string; what: string; requiredName: string | null; departmentId?: string },
  a: { id: string; needId: string; place: number; userId: string; name: string; start: number; end: number }, cover?: { start: number; end: number }): GapRef {
  const [start, end] = cover ? [cover.start, cover.end] : a.end - a.start >= 120 ? [a.start + 60, a.start + 120] : [a.start, a.end];
  return { ...at, start, end, needId: a.needId, place: a.place, classRefs: [], replace: null,
    handOver: { assignmentId: a.id, userId: a.userId, name: a.name || "Someone", from: a.start, to: a.end } };
}

/** Plan one teacher (or nobody) on each of a gap's classes, one after another so each lands on
 *  their shift in turn. */
async function teachAll(gap: GapRef, userId: string | null, change: ReturnType<typeof changeOf>) {
  const out = [];
  for (const ref of gap.classRefs) {
    const result = await planTeacher({ siteId: gap.siteId, date: gap.date, classRef: ref, userId, departmentId: gap.departmentId }, change);
    out.push(result);
    if (!result.ok) break;
  }
  return out;
}

/** "Who can fill it" (owner decision, 6 October 2026): everyone who works at the site, best fit
 *  first; warnings sit beside each name and never stop anyone. Put someone on for the whole gap
 *  or part of it. On a day that has come, the change asks for its reason. */
export function FillSheet({ gap, live, onClose }: { gap: GapRef | null; live: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!gap} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent portalClassName="turnfin-module" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>{gap?.handOver ? `Who covers ${gap.handOver.name.split(" ")[0]}` : gap?.classRefs.length ? "Who teaches it" : "Who can fill it"}</SheetTitle>
          <SheetDescription>Best fit first: qualified, free, then fewest hours this week. Warnings never stop you.{gap?.classRefs.length ? " This changes that day only, and the swim school follows it." : ""}</SheetDescription>
        </SheetHeader>
        {/* A fresh body for each gap, so its list, search and error start empty. */}
        {gap ? <FillBody key={`${gap.what}|${gap.date}|${gap.start}|${gap.place ?? gap.classRefs.join(",")}`} gap={gap} live={live} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function FillBody({ gap, live, onClose }: { gap: GapRef; live: boolean; onClose: () => void }) {
  const router = useRouter();
  const [fits, setFits] = useState<Fit[] | null>(null);
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let stale = false;
    whoCanFill({ siteId: gap.siteId, date: gap.date, start: gap.start, end: gap.end, typeId: gap.typeId }).then((list) => { if (!stale) setFits(list); });
    return () => { stale = true; };
  }, [gap]);

  function put(userId: string | null, form: HTMLFormElement | null) {
    const data = form ? new FormData(form) : new FormData();
    const change = changeOf(data);
    if (live && !change.reason) { setError("This day has come. Choose why it changed first."); form?.querySelector<HTMLSelectElement>("select[name=reason]")?.focus(); return; }
    const from = parseClock(String(data.get("from") ?? clock(gap.start))) ?? gap.start;
    const to = parseClock(String(data.get("to") ?? clock(gap.end))) ?? gap.end;
    start(async () => {
      setError(null);
      const results = gap.handOver
        ? (userId ? [await handOver(gap.handOver.assignmentId, { userId, start: clock(from), end: clock(to), departmentId: gap.departmentId }, change)] : [])
        : gap.classRefs.length
        ? await teachAll(gap, userId, change)
        : userId ? [await assign(gap.replace?.assignmentId ?? null, { needId: gap.needId!, place: gap.place!, userId, start: clock(from), end: clock(to), departmentId: gap.departmentId }, change)] : [];
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) { setError(failed.error); return; }
      toast.success(gap.handOver ? "Cover put on" : userId ? "Put on the rota" : "Taken off the class");
      onClose();
      router.refresh();
    });
  }

  const shown = (fits ?? []).filter((f) => f.userId !== gap.handOver?.userId && f.userId !== gap.teacher?.userId && f.name.toLowerCase().includes(query.trim().toLowerCase()));
  const formId = "rota-fill-form";
  const bounds = gap.handOver ? { from: gap.handOver.from, to: gap.handOver.to } : { from: gap.start, to: gap.end };
  return (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="rota-gap-card">
              <span className="flex items-center gap-1.5 font-semibold">{gap.handOver ? <ArrowLeftRight aria-hidden="true" className="size-4" /> : gap.teacher ? null : <TriangleAlert aria-hidden="true" className="size-4" />}{gap.what}</span>
              <small>{gap.dateLabel}, {gap.handOver ? `${gap.handOver.name} on it ${clock(gap.handOver.from)} to ${clock(gap.handOver.to)}` : `${clock(gap.start)} to ${clock(gap.end)}`}{gap.requiredName ? ` · needs ${qualificationShort(gap.requiredName)}` : ""}{gap.classRefs.length > 1 ? ` · ${gap.classRefs.length} classes` : ""}</small>
            </div>
            <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              {gap.teacher && !gap.replace ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">{gap.teacher.name} teaches {gap.classRefs.length > 1 ? "them" : "it"} that day. Choose someone below to change it.</p>
                  <Button type="button" variant="outline" disabled={pending} onClick={() => put(null, document.getElementById(formId) as HTMLFormElement | null)}>Take {gap.teacher.name.split(" ")[0]} off</Button>
                </div>
              ) : null}
              {gap.replace ? <p className="text-sm">{gap.replace.name} is off. The person you choose takes their place{gap.classRefs.length ? "" : " for this time"}.</p> : null}
              {gap.handOver ? <p className="text-sm">The person you choose covers this time on the same place. {gap.handOver.name.split(" ")[0]} keeps the time before and after it, so the activity stays covered.</p> : null}
              {gap.classRefs.length || gap.replace ? null : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label={gap.handOver ? "Cover from" : "From"} htmlFor="rota-fill-from"><Input id="rota-fill-from" name="from" type="time" step={300} defaultValue={clock(gap.start)} min={clock(bounds.from)} max={clock(bounds.to)} className="min-h-11" /></Field>
                  <Field label={gap.handOver ? "Cover to" : "To"} htmlFor="rota-fill-to"><Input id="rota-fill-to" name="to" type="time" step={300} defaultValue={clock(gap.end)} min={clock(bounds.from)} max={clock(bounds.to)} className="min-h-11" /></Field>
                </div>
              )}
              {live ? <ChangeFields id="rota-fill" suggested="cover" /> : null}
            </form>
            <SearchField label="Search people" value={query} onValueChange={setQuery} placeholder="Search people at this site" />
            {error ? <p role="alert" className="text-sm text-ui-destructive">{error}</p> : null}
            {fits === null ? <p className="text-sm text-ui-muted-foreground" role="status">Finding who can fill it</p> : shown.length === 0 ? (
              <p className="text-sm text-ui-muted-foreground">Nobody matches.</p>
            ) : (
              <ul className="pc-rows" aria-label="People, best fit first">
                {shown.map((f) => (
                  <li key={f.userId} className="pc-row" {...(f.issues.includes("off") ? { "data-muted": "" } : {})}>
                    <Avatar size="lg"><AvatarFallback>{initials(f.name)}</AvatarFallback></Avatar>
                    <span className="pc-row-body">
                      <span className="pc-row-title">{f.name}</span>
                      <span className="pc-row-hint">{f.day.length ? `On ${f.day.map((w) => `${w.label} ${clock(w.start)}–${clock(w.end)}`).join(", ")}` : "Nothing else that day"} · {f.weekMinutes ? `${duration(f.weekMinutes)} this week` : "no hours this week"}</span>
                      <span className="rota-tags">
                        {f.issues.length === 0 ? <Tag meta={ROTA_FIT_META.good} /> : f.issues.map((i) => (
                          <Tag key={i} meta={ROTA_FIT_META[i]} label={i === "long" ? `Makes a ${duration(f.dayLength)} day` : undefined} />
                        ))}
                      </span>
                    </span>
                    <Button type="button" variant="outline" size="icon" aria-label={gap.handOver ? `${f.name} covers` : `Put ${f.name} on`} disabled={pending}
                      onClick={() => put(f.userId, document.getElementById(formId) as HTMLFormElement | null)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
  );
}
