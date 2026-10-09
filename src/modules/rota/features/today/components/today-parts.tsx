"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { FillSheet, type GapRef } from "@/modules/rota/shared/components/fill-sheet";
import { assign, planTeacher } from "@/modules/rota/shared/actions";
import { markTimepointUpdated } from "@/modules/rota/features/today/server/actions";
import { clock } from "@/modules/rota/shared/constants";
import { ROTA_DAY_META, ROTA_FIT_META, activityIcon } from "@/modules/rota/shared/meta";
import { duration } from "@/modules/rota/shared/shifts";
import { toast } from "@/lib/toast";

export type TodayGap = GapRef & {
  icon: string;
  /** "Aoife Byrne is off sick", or how many classes. */
  why: string;
  fits: { userId: string; name: string; caption: string; issues: string[]; dayLength: number }[];
};

/** Today's gaps, soonest first, each with its best three fits and a way to see everyone. Putting
 *  someone on logs the change as covering an absence, or as filling a gap in the plan. */
export function TodayGaps({ gaps }: { gaps: TodayGap[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<GapRef | null>(null);
  const [pending, start] = useTransition();
  function put(gap: TodayGap, userId: string) {
    const change = { reason: gap.replace ? "cover" : "fill", note: "" } as const;
    start(async () => {
      const results = gap.classRefs.length
        ? await Promise.all(gap.classRefs.map((ref) => planTeacher({ siteId: gap.siteId, date: gap.date, classRef: ref, userId }, change)))
        : [await assign(gap.replace?.assignmentId ?? null, { needId: gap.needId!, place: gap.place!, userId, start: clock(gap.start), end: clock(gap.end) }, change)];
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) { toast.error(failed.error); return; }
      toast.success("Put on the rota");
      router.refresh();
    });
  }
  return (
    <>
      <ul className="pc-rows">
        {gaps.map((gap, i) => {
          const Icon = activityIcon(gap.icon);
          return (
            <li key={`${gap.what}-${gap.start}-${i}`} className="pc-row flex-col items-stretch" {...(i === 0 ? { "data-first": "" } : {})}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{gap.what}, {clock(gap.start)} to {clock(gap.end)}</span>
                  <span className="pc-row-hint">{gap.why}</span>
                </span>
                <Tag meta={ROTA_DAY_META.gaps} label={gap.replace ? "Cover needed" : "Gap"} />
              </div>
              <div className="rota-fits">
                {gap.fits.map((f) => (
                  <div key={f.userId} className="pc-row">
                    <Avatar size="lg"><AvatarFallback>{initials(f.name)}</AvatarFallback></Avatar>
                    <span className="pc-row-body">
                      <span className="pc-row-title">{f.name}</span>
                      <span className="pc-row-hint">{f.caption}</span>
                      {f.issues.length ? <span className="rota-tags">{f.issues.map((x) => (
                        <Tag key={x} meta={ROTA_FIT_META[x as keyof typeof ROTA_FIT_META]} label={x === "long" ? `Makes a ${duration(f.dayLength)} day` : undefined} />
                      ))}</span> : null}
                    </span>
                    <Button type="button" variant="outline" size="icon" aria-label={`Put ${f.name} on ${gap.what}, ${clock(gap.start)} to ${clock(gap.end)}`} disabled={pending} onClick={() => put(gap, f.userId)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              <div><Button type="button" variant="ghost" onClick={() => setOpen(gap)}><Users aria-hidden="true" />Everyone who could</Button></div>
            </li>
          );
        })}
      </ul>
      <FillSheet gap={open} live onClose={() => setOpen(null)} />
    </>
  );
}

/** The change is in Timepoint now: closes its follow-up. */
export function TimepointDone({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => {
      const result = await markTimepointUpdated(id);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Marked as done in Timepoint");
      router.refresh();
    })}>Done in Timepoint</Button>
  );
}
