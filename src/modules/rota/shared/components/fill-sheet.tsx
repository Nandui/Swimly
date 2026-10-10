"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Field } from "@/components/form-dialog";
import { SearchField } from "@/components/ui-kit/search-field";
import { Tag } from "@/components/ui-kit/tag";
import { ChangeFields, changeOf } from "@/modules/rota/shared/components/change-fields";
import { assign, planTeacher, whoCanFill } from "@/modules/rota/shared/actions";
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
  /** Covering someone who is off: their place on the activity, swapped to the person chosen. */
  replace: { assignmentId: string | null; name: string } | null;
};

/** "Who can fill it" (owner decision, 6 October 2026): everyone who works at the site, best fit
 *  first; warnings sit beside each name and never stop anyone. Put someone on for the whole gap
 *  or part of it. On a day that has come, the change asks for its reason. */
export function FillSheet({ gap, live, onClose }: { gap: GapRef | null; live: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!gap} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent portalClassName="turnfin-module" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>Who can fill it</SheetTitle>
          <SheetDescription>Best fit first: qualified, free, then fewest hours this week. Warnings never stop you.</SheetDescription>
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

  function put(userId: string, form: HTMLFormElement | null) {
    const data = form ? new FormData(form) : new FormData();
    const change = changeOf(data);
    if (live && !change.reason) { setError("This day has come. Choose why it changed first."); form?.querySelector<HTMLSelectElement>("select[name=reason]")?.focus(); return; }
    const from = parseClock(String(data.get("from") ?? clock(gap.start))) ?? gap.start;
    const to = parseClock(String(data.get("to") ?? clock(gap.end))) ?? gap.end;
    start(async () => {
      setError(null);
      const results = gap.classRefs.length
        ? await Promise.all(gap.classRefs.map((ref) => planTeacher({ siteId: gap.siteId, date: gap.date, classRef: ref, userId }, change)))
        : [await assign(gap.replace?.assignmentId ?? null, { needId: gap.needId!, place: gap.place!, userId, start: clock(from), end: clock(to) }, change)];
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) { setError(failed.error); return; }
      toast.success("Put on the rota");
      onClose();
      router.refresh();
    });
  }

  const shown = (fits ?? []).filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));
  const formId = "rota-fill-form";
  return (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="rota-gap-card">
              <span className="flex items-center gap-1.5 font-semibold"><TriangleAlert aria-hidden="true" className="size-4" />{gap.what}</span>
              <small>{gap.dateLabel}, {clock(gap.start)} to {clock(gap.end)}{gap.requiredName ? ` · needs ${qualificationShort(gap.requiredName)}` : ""}{gap.classRefs.length > 1 ? ` · ${gap.classRefs.length} classes` : ""}</small>
            </div>
            <form id={formId} className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              {gap.replace ? <p className="text-sm">{gap.replace.name} is off. The person you choose takes their place{gap.classRefs.length ? "" : " for this time"}.</p> : null}
              {gap.classRefs.length || gap.replace ? null : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="From" htmlFor="rota-fill-from"><Input id="rota-fill-from" name="from" type="time" step={900} defaultValue={clock(gap.start)} min={clock(gap.start)} max={clock(gap.end)} className="min-h-11" /></Field>
                  <Field label="To" htmlFor="rota-fill-to"><Input id="rota-fill-to" name="to" type="time" step={900} defaultValue={clock(gap.end)} min={clock(gap.start)} max={clock(gap.end)} className="min-h-11" /></Field>
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
                    <Button type="button" variant="outline" size="icon" aria-label={`Put ${f.name} on`} disabled={pending}
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
