"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { ChangeReview } from "@/components/ui-kit/change-review";
import { Skeleton } from "@/components/shadcn/skeleton";
import { FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LegendAgreementField } from "@/modules/activities/shared/enrolment/components/legend-agreement-field";
import { DAY_META, formatTime } from "@/modules/activities/shared/courses/constants";
import { changePlace, levelNote } from "@/modules/activities/shared/enrolment/change";
import { MOVE_META } from "@/modules/activities/features/together/constants";
import { checkMove, makeMove } from "@/modules/activities/features/together/server/actions";
import type { Place } from "@/modules/activities/features/together/server/data/together";
import type { Placement } from "@/modules/activities/features/together/server/match";
import type { MoveStep, StepCheck } from "@/modules/activities/features/together/server/move";

/** A child in the group, with the places they hold now. */
export type GroupMember = { id: string; name: string; places: Place[] };

const KEEP = "keep";

/** "Move them here": one option of Together made real. Before anything changes it shows, for each
 *  child, the class they leave and the class they join (day, time, level), whether their level
 *  changes, and anything the usual rules need: a reason for a level they have not earned, the
 *  Legend agreement for a new place, a warning when they were assessed at another centre. One
 *  button then makes every move together, or none; like every move and enrolment it waits five
 *  seconds, starting again when a choice here changes, and stays off while a child cannot move. */
export function MoveDialog({ heading, placements, group }: {
  heading: string;
  placements: Placement[];
  group: GroupMember[];
}) {
  const moving = placements.filter((p) => !p.alreadyIn);
  const staying = placements.filter((p) => p.alreadyIn);
  const placesOf = (p: Placement) => group.find((m) => m.id === p.studentId)?.places ?? [];
  // Places in the same programme are the ones a move replaces; others are kept.
  const sameProgramme = (p: Placement) => placesOf(p).filter((place) => place.programmeId === p.course.level.programme.id);
  const [from, setFrom] = useState<Record<string, string>>(() => Object.fromEntries(
    moving.map((p) => [p.studentId, sameProgramme(p)[0]?.enrolmentId ?? KEEP])));
  const [checks, setChecks] = useState<StepCheck[] | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const steps = (data?: FormData): MoveStep[] => moving.map((p) => {
    const legend = data?.get(`legend-${p.studentId}`);
    return {
      studentId: p.studentId,
      toCourseId: p.course.id,
      fromEnrolmentId: from[p.studentId] === KEEP ? null : from[p.studentId],
      reason: String(data?.get(`reason-${p.studentId}`) ?? ""),
      ...(legend === "DONE" || legend === "PENDING" ? { legendAgreement: legend } : {}),
    };
  });

  async function check() {
    setChecks(null);
    setCheckError(null);
    const result = await checkMove(steps());
    if (result.ok) setChecks(result.checks);
    else setCheckError(result.error);
  }

  const names = moving.map((p) => p.name.split(" ")[0]);
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const slot = (p: Placement) => `${p.course.name ?? p.course.level.name} · ${DAY_META[p.course.dayOfWeek].label} ${formatTime(p.course.startMinutes)}`;

  return (
    <FormDialog
      trigger={
        <Button variant="outline">
          <ArrowRightLeft aria-hidden="true" />
          {moving.length === placements.length && placements.length > 1 ? "Move them here" : `Move ${who} here`}
        </Button>
      }
      title={`Move ${who} to ${heading}?`}
      description="Check each child below. Nothing changes until you press the button at the bottom."
      submitLabel={moving.length === 1 ? `Move ${names[0]}` : `Move ${moving.length} children`}
      pendingLabel="Moving…"
      successMessage={`Done. ${who} ${moving.length === 1 ? "is" : "are"} now in the new ${moving.length === 1 ? "class" : "classes"}, starting today.`}
      width="sm:max-w-2xl"
      onOpen={check}
      countdown={{
        key: JSON.stringify([from, checks?.length ?? null]),
        blocked: !checks || !!checkError || checks.some((c) => c.problem),
      }}
      submit={(data) => makeMove(steps(data))}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <ItemGroup>
          {moving.map((p) => {
            const candidates = sameProgramme(p);
            const chosen = candidates.find((place) => place.enrolmentId === from[p.studentId]) ?? null;
            const result = checks?.find((c) => c.studentId === p.studentId);
            const kind = chosen
              ? (chosen.levelName === p.course.level.name ? MOVE_META.moves : MOVE_META.level)
              : MOVE_META.joins;
            return (
              <Item key={p.studentId} variant="outline" role="listitem" className="items-start">
                <ItemContent className="min-w-0 gap-3">
                  <ChangeReview
                    badge={<Tag meta={kind} />}
                    change={{
                      subject: p.name,
                      kind: chosen ? "move" : "enrol",
                      from: chosen ? [chosen.place] : [],
                      to: changePlace(p.course, p.course.club.name),
                      notes: chosen ? levelNote(chosen.levelName, p.course.level.name)
                        : [candidates.length ? `Keeps ${candidates.map((c) => c.label).join(" and ")}.` : "No place in this programme yet."],
                    }}
                  />
                  {candidates.length > 0 ? (
                    <Select
                      label="Move from"
                      value={from[p.studentId]}
                      onValueChange={(value) => setFrom((current) => ({ ...current, [p.studentId]: value }))}
                      options={[
                        ...candidates.map((c) => ({ value: c.enrolmentId, label: c.label })),
                        { value: KEEP, label: "Keep that place and add this class too" },
                      ]}
                    />
                  ) : null}
                  {!checks && !checkError ? <Skeleton className="h-4 w-1/2" /> : null}
                  {result?.problem ? <Notice tone="error" title={result.problem} description="Close this and pick another option." /> : null}
                  {result?.elsewhere ? (
                    <Notice tone="warning" title={`Assessed at ${result.elsewhere.assessedAt}`}
                      description={`Parents are told lessons are at the centre where their child was assessed. This class is at ${result.elsewhere.classAt}. Check with the family first.`} />
                  ) : null}
                  {result && !result.earned ? (
                    <Textarea
                      name={`reason-${p.studentId}`}
                      label={`Why ${p.name.split(" ")[0]} goes into ${p.course.level.name}`}
                      description={`They have not finished ${result.below ?? "the level below"} and no assessment has placed them there. This goes on their record.`}
                      required
                      rows={2}
                    />
                  ) : null}
                  {!chosen ? <LegendAgreementField name={`legend-${p.studentId}`} label={`Legend billing agreement for ${p.name.split(" ")[0]}`} /> : null}
                </ItemContent>
              </Item>
            );
          })}
          {staying.map((p) => (
            <Item key={p.studentId} variant="outline" role="listitem">
              <ItemContent className="min-w-0">
                <ItemTitle>{p.name}</ItemTitle>
                <ItemDescription>Already in {slot(p)}. Nothing changes for them.</ItemDescription>
              </ItemContent>
              <Tag meta={MOVE_META.stays} />
            </Item>
          ))}
        </ItemGroup>
        {checkError ? <Notice tone="error" title="Couldn't check the places" description={checkError} /> : null}
        <Notice
          title="What happens"
          description="Each new place starts today. An old place ends today and stays in their history, with its attendance and marks. Every change is written to the activity log with your name."
        />
      </div>
    </FormDialog>
  );
}
