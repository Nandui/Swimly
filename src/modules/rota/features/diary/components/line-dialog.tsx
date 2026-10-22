"use client";

import { CalendarDays } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { useDiary } from "@/modules/rota/features/diary/components/context";
import { ChangeTime, TakeOff } from "@/modules/rota/features/diary/components/person-sheet";
import { SubPlace } from "@/modules/rota/features/diary/components/sub-place";
import { firstName, lineTitle, lineWhere, span as spanWords, subTime } from "@/modules/rota/features/diary/components/words";

const PORTAL = "turnfin-module";

/** One thing on someone's day, opened from its block on the timeline (owner, 21 October 2026:
 *  "can't remove activities from there, why?"): what and when, with taking them off it and
 *  changing their time right there, and their whole day a tap away. */
export function LineDialog({ target, onClose }: { target: { userId: string; key: string } | null; onClose: () => void }) {
  const ctx = useDiary();
  const person = target ? ctx.diary.people.find((p) => p.userId === target.userId) ?? null : null;
  const line = target ? person?.lines.find((l) => l.key === target.key) ?? null : null;
  const first = person ? firstName(person.name) : "";
  const placed = line ? line.subs.filter((x) => x.at !== null) : [];
  return (
    <Dialog open={!!line} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent portalClassName={PORTAL} className="sm:max-w-md">
        {person && line ? (
          <>
            <DialogHeader>
              <DialogTitle>{person.name}: {lineTitle(line)}</DialogTitle>
              <DialogDescription>{ctx.dateLabel}, <span className="tabular-nums">{spanWords(line)}</span>{lineWhere(line) ? `, ${lineWhere(line)}` : ""}</DialogDescription>
            </DialogHeader>
            {placed.length ? (
              <ul className="diary-subs-list" aria-label="Sub-activities">
                {placed.map((x, i) => (
                  <li key={x.id ? `${x.id}-${x.at}` : i}>
                    <span className="tabular-nums">{subTime(x)}</span>
                    {x.when === "during" && x.id && line.assignmentId && ctx.canChange && ctx.departmentFor
                      ? <SubPlace person={person} line={line} sub={{ id: x.id, name: x.name, at: x.at, until: x.until ?? null }} />
                      : <span>{x.name}</span>}
                  </li>
                ))}
              </ul>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { onClose(); ctx.person(person.userId); }}><CalendarDays aria-hidden="true" />{first}&apos;s whole day</Button>
              {line.kind !== "class" && line.assignmentId ? <ChangeTime person={person} line={line} /> : null}
              <TakeOff person={person} lines={[line]} label={`Take ${first} off`} />
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
