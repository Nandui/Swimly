"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Banner } from "@/components/workspace/feedback";
import { Button } from "@/components/workspace/actions";
import { Card } from "@/components/workspace/layout";
import { Collapsible } from "@/components/workspace/overlays";
import { IconButton } from "@/components/workspace/actions";
import { Item } from "@/components/workspace/layout";
import { List } from "@/components/workspace/layout";
import { HStack, StackItem, VStack } from "@/components/workspace/layout";
import { StatusDot } from "@/components/workspace/feedback";
import { Tab, TabList } from "@/components/workspace/choices";
import { Heading, Text } from "@/components/workspace/typography";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/workspace/choices";
import { VisuallyHidden } from "@/components/workspace/layout";
import { SaveBar } from "@/components/attendance/register-form";
import { SAVE_TIMEOUT_MS, SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import { Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import type {
  AttendanceStatus,
  CompetencyStatus,
} from "@/generated/prisma/client";
import { saveClassAssessment } from "@/lib/progression/actions/assess";
import { toast } from "@/lib/toast";
import { Icon } from "@/components/workspace/misc";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import { ENROLMENT_STATUS_META, PLACEMENT_META } from "@/lib/enrolment/constants";

/** The checklist as the deck uses it: one competency at a time, across the
 *  whole class.
 *
 *  A lesson works like that — the instructor runs a drill, then marks who
 *  got it — so the competency is the unit of the moment and the swimmers
 *  are the list. Each swimmer is one row with Not Achieved and Achieved.
 *  Missing marks default to Not Achieved. Every change across every
 *  competency sits behind one Save, mirrored to `localStorage` so a
 *  dropped connection or a closed tab loses nothing.
 *
 *  It knows who was in the water. Once attendance is taken, the swimmers
 *  marked absent fold away under "Not in today": still markable, for a
 *  correction, but not in the way, and not swept up by "Everyone achieved".
 *  The per-swimmer checklist still exists on the class's assessment page
 *  for the desk. */

type Choice = CompetencyStatus | null;

export type DeckCompetency = {
  id: string;
  name: string;
  description: string | null;
};

export type DeckSwimmer = {
  studentId: string;
  name: string;
  offLevel: boolean;
  completed: boolean;
  marks: Record<string, Choice>;
};

const MARK_LABEL: Record<CompetencyStatus, string> = {
  WORKING_ON: "Not Achieved",
  ACHIEVED: "Achieved",
};
const MARK_ORDER: CompetencyStatus[] = ["WORKING_ON", "ACHIEVED"];

/** The mark as a status dot beside the name. */
const DOT: Record<CompetencyStatus, "success" | "warning"> = {
  WORKING_ON: "warning",
  ACHIEVED: "success",
};


type Marks = Map<string, Map<string, Choice>>;
type Stored = Record<string, Record<string, Choice>>;

function storageKey(courseId: string, date: string) {
  return `swimly:assess:${courseId}:${date}`;
}

export function DeckChecklist(props: React.ComponentProps<typeof DeckChecklistState>) {
  return <DeckChecklistState key={`${props.courseId}:${props.date}:${props.levelId}`} {...props} />;
}

function DeckChecklistState({
  courseId,
  date,
  levelId,
  competencies,
  swimmers,
  attendance,
  readOnly,
  doneHref,
}: {
  courseId: string;
  date: string;
  levelId: string;
  competencies: DeckCompetency[];
  swimmers: DeckSwimmer[];
  /** Today's attendance by swimmer, or null when it has not been taken. */
  attendance: Record<string, AttendanceStatus | null> | null;
  readOnly: boolean;
  /** Where "done" goes once everything is saved. */
  doneHref: string;
}) {
  const initial = React.useMemo<Marks>(
    () =>
      new Map(
        swimmers.map((swimmer) => [
          swimmer.studentId,
          new Map(competencies.map((c) => [c.id, swimmer.marks[c.id] ?? null])),
        ]),
      ),
    [swimmers, competencies],
  );

  const [marks, setMarks] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  // Marks that came back from the phone's mirror, and a save made on this
  // visit: both change what the bar at the bottom should say.
  const [restored, setRestored] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [storageUnavailable, setStorageUnavailable] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // Who was in the water. Before attendance is taken nobody is ruled out.
  const inToday = React.useCallback(
    (studentId: string) => {
      if (!attendance) return true;
      const status = attendance[studentId];
      return status === "PRESENT" || status === "LATE";
    },
    [attendance],
  );
  const here = swimmers.filter((s) => inToday(s.studentId));
  const away = swimmers.filter((s) => !inToday(s.studentId));

  // Open on the first competency the swimmers here have not all got yet.
  const [current, setCurrent] = React.useState(() => {
    const index = competencies.findIndex((c) =>
      here.some((s) => (s.marks[c.id] ?? null) !== "ACHIEVED"),
    );
    return index === -1 ? 0 : index;
  });

  const key = storageKey(courseId, date);

  // Marks made before the connection dropped come back from the mirror.
  React.useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // localStorage is an external store unavailable during server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageUnavailable(true);
      return;
    }
    if (!raw || readOnly) return;
    try {
      const stored = JSON.parse(raw) as Stored;
      setMarks((previous) => {
        const next: Marks = new Map(previous);
        for (const [studentId, byCompetency] of Object.entries(stored)) {
          const row = next.get(studentId);
          if (!row) continue;
          const copy = new Map(row);
          if (!byCompetency || typeof byCompetency !== "object") continue;
          for (const [competencyId, status] of Object.entries(byCompetency)) {
            if (copy.has(competencyId) && (status === null || status === "WORKING_ON" || status === "ACHIEVED")) copy.set(competencyId, status);
          }
          next.set(studentId, copy);
        }
        return next;
      });
      setRestored(true);
      setDirty(true);
    } catch {
      try { window.localStorage.removeItem(key); } catch { setStorageUnavailable(true); }
    }
  }, [key, readOnly]);

  // After a save revalidates, adopt what the server now says.
  const [syncedTo, setSyncedTo] = React.useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    if (!dirty) setMarks(initial);
  }

  const changes = React.useMemo(() => {
    const list: { studentId: string; competencyId: string; status: Choice }[] =
      [];
    for (const [studentId, row] of marks) {
      const was = initial.get(studentId);
      for (const [competencyId, status] of row) {
        if ((was?.get(competencyId) ?? null) !== status) {
          list.push({ studentId, competencyId, status });
        }
      }
    }
    return list;
  }, [marks, initial]);

  function remember(next: Marks) {
    const diff: Stored = {};
    for (const [studentId, row] of next) {
      const was = initial.get(studentId);
      for (const [competencyId, status] of row) {
        if ((was?.get(competencyId) ?? null) !== status) {
          (diff[studentId] ??= {})[competencyId] = status;
        }
      }
    }
    try {
      if (Object.keys(diff).length === 0) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(diff));
    } catch {
      setStorageUnavailable(true);
    }
  }

  function update(mutate: (next: Marks) => void) {
    const next: Marks = new Map();
    for (const [studentId, row] of marks) next.set(studentId, new Map(row));
    mutate(next);
    remember(next);
    setMarks(next);
    setDirty(true);
    setSaved(false);
  }

  /** The segmented control selects one of the two competency statuses. */
  function choose(studentId: string, competencyId: string, status: Choice) {
    update((next) => {
      next.get(studentId)?.set(competencyId, status);
    });
  }

  /** Everyone who was in the water today. */
  function everyone(competencyId: string, status: CompetencyStatus) {
    update((next) => {
      for (const swimmer of here)
        next.get(swimmer.studentId)?.set(competencyId, status);
    });
  }

  function save() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveClassAssessment>>;
      try {
        result = await withTimeout(
          saveClassAssessment({ levelId, marks: changes }),
          SAVE_TIMEOUT_MS,
        );
      } catch {
        startTransition(() => setError(SAVE_UNCONFIRMED_MESSAGE));
        return;
      }
      if (result.ok) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Nothing to clear.
        }
        toast.success("Marks saved");
        startTransition(() => {
          setError(null);
          setRestored(false);
          setSaved(true);
          setDirty(false);
        });
      } else {
        startTransition(() => setError(result.error));
      }
    });
  }

  if (competencies.length === 0) {
    return (
      <VStack gap={4} vAlign="start">
        <Text as="p" display="block" color="secondary">
          This level has no competencies yet, so there is nothing to mark.
        </Text>
        <Button
          label="Back to Today"
          variant="secondary"
          size="lg"
          href={doneHref}
          icon={<Icon icon={ChevronLeft} size="sm" />}
        />
      </VStack>
    );
  }

  const currentIndex = Math.min(current, competencies.length - 1);
  const competency = competencies[currentIndex];
  const achievedHere = here.filter(
    (s) => marks.get(s.studentId)?.get(competency.id) === "ACHIEVED",
  ).length;
  const allAchieved = (competencyId: string) =>
    here.length > 0 &&
    here.every((s) => marks.get(s.studentId)?.get(competencyId) === "ACHIEVED");
  const achievedFor = (studentId: string) =>
    competencies.filter((c) => marks.get(studentId)?.get(c.id) === "ACHIEVED")
      .length;
  const markedAtAll = [...marks.values()].some((row) =>
    [...row.values()].some(Boolean),
  );

  const row = (swimmer: DeckSwimmer, dimmed: boolean) => {
    const value = marks.get(swimmer.studentId)?.get(competency.id) ?? "WORKING_ON";
    const late = attendance?.[swimmer.studentId] === "LATE";
    return (
      <Item
        key={swimmer.studentId}
        as="li"
        align="start"
        isDisabled={dimmed && readOnly}
        label={
          <HStack gap={2} vAlign="center" wrap="wrap">
            <StatusDot
              variant={DOT[value]}
              label={MARK_LABEL[value]}
            />
            <Text
              type="large"
              weight="semibold"
              color={dimmed ? "secondary" : "primary"}
            >
              {swimmer.name}
            </Text>
            {late ? <Tag color={ATTENDANCE_STATUS_META.LATE.color}>{ATTENDANCE_STATUS_META.LATE.label}</Tag> : null}
            {swimmer.completed ? <Tag color={ENROLMENT_STATUS_META.COMPLETED.color}>{ENROLMENT_STATUS_META.COMPLETED.label}</Tag> : null}
            {swimmer.offLevel ? (
              <Tag color={PLACEMENT_META.otherLevel.color}>{PLACEMENT_META.otherLevel.label}</Tag>
            ) : null}
          </HStack>
        }
        description={
          <VStack gap={2}>
            <Text color="secondary" hasTabularNumbers>
              {achievedFor(swimmer.studentId)} of {competencies.length} achieved
            </Text>
            <HStack>
              <SegmentedControl
                label={`${competency.name} — ${swimmer.name}`}
                size="lg"
                value={value}
                isDisabled={readOnly || pending}
                onChange={(next) =>
                  choose(
                    swimmer.studentId,
                    competency.id,
                    next as CompetencyStatus,
                  )
                }
              >
                {MARK_ORDER.map((status) => (
                  <SegmentedControlItem
                    key={status}
                    value={status}
                    label={MARK_LABEL[status]}
                  />
                ))}
              </SegmentedControl>
            </HStack>
          </VStack>
        }
      />
    );
  };

  return (
    <VStack gap={4}>
      {/* Every competency, one number each: where you are and what is
          already done. The strip scrolls under the thumb on a phone. */}
      <TabList
        aria-label="Competencies"
        value={String(currentIndex)}
        onChange={(next) => setCurrent(Number(next))}
        overflow="scroll"
        size="lg"
      >
        {competencies.map((c, index) => (
          <Tab
            key={c.id}
            value={String(index)}
            label={`${index + 1}`}
            aria-label={`${index + 1}. ${c.name}`}
            endContent={
              allAchieved(c.id) ? (
                <Icon icon={Check} size="sm" label="Everyone achieved" />
              ) : undefined
            }
          />
        ))}
      </TabList>

      <Card>
        <VStack gap={3}>
          <HStack gap={3} vAlign="start" hAlign="between">
            <StackItem size="fill">
              <VStack gap={1}>
                <Text type="supporting" hasTabularNumbers>
                  Competency {currentIndex + 1} of {competencies.length}
                </Text>
                <Heading level={2} id="deck-competency">
                  {competency.name}
                </Heading>
                {competency.description ? (
                  <Text
                    as="p"
                    display="block"
                    color="secondary"
                    className="max-w-prose"
                  >
                    {competency.description}
                  </Text>
                ) : null}
                <Text as="p" display="block" color="secondary">
                  <Num>{achievedHere}</Num> of <Num>{here.length}</Num>
                  {attendance ? " in today" : ""} achieved
                </Text>
              </VStack>
            </StackItem>
            <HStack gap={1.5}>
              <IconButton
                label="Previous competency"
                variant="secondary"
                size="lg"
                icon={<Icon icon={ChevronLeft} size="md" />}
                isDisabled={currentIndex === 0}
                onClick={() => setCurrent(Math.max(0, currentIndex - 1))}
              />
              <IconButton
                label="Next competency"
                variant="secondary"
                size="lg"
                icon={<Icon icon={ChevronRight} size="md" />}
                isDisabled={currentIndex === competencies.length - 1}
                onClick={() =>
                  setCurrent(Math.min(competencies.length - 1, currentIndex + 1))
                }
              />
            </HStack>
          </HStack>
          {readOnly || here.length === 0 ? null : (
            <HStack>
              <Button
                label={
                  attendance
                    ? "Everyone in today achieved"
                    : "Everyone achieved"
                }
                variant="secondary"
                size="lg"
                icon={<Icon icon={Check} size="sm" />}
                onClick={() => everyone(competency.id, "ACHIEVED")}
                isDisabled={pending}
              />
            </HStack>
          )}
        </VStack>
      </Card>

      {swimmers.length === 0 ? (
        <Text as="p" display="block" color="secondary">
          Nobody in this class yet.
        </Text>
      ) : here.length === 0 ? (
        <Text as="p" display="block" color="secondary">
          Nobody was marked in today.
        </Text>
      ) : (
        <List hasDividers>{here.map((s) => row(s, false))}</List>
      )}

      {away.length > 0 ? (
        <Collapsible
          defaultIsOpen={false}
          trigger={
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Text weight="semibold">Not in today</Text>
              <VisuallyHidden>,</VisuallyHidden>
              <Text color="secondary" hasTabularNumbers>
                {away.length} {away.length === 1 ? "swimmer" : "swimmers"}
              </Text>
            </HStack>
          }
        >
          <VStack paddingBlockStart={3}>
            <List hasDividers>{away.map((s) => row(s, true))}</List>
          </VStack>
        </Collapsible>
      ) : null}

      {error ? (
        <Banner status="error" title={error} collapsible={false} />
      ) : null}
      {storageUnavailable && !readOnly ? <Banner status="warning" title="This browser cannot keep a backup. Keep this tab open until marks are saved." collapsible={false} /> : null}

      {/* One bar. Save while there is something to save; Done once a save
          has landed; and a quiet way back before anything has been marked,
          so the primary button is never the way out of an empty page. */}
      <SaveBar
        status={
          changes.length > 0
            ? restored
              ? "Kept on this phone, not saved yet"
              : `${changes.length} ${changes.length === 1 ? "mark" : "marks"} not saved yet`
            : saved
              ? "Saved"
              : markedAtAll
                ? "Up to date"
                : "Nothing marked yet"
        }
      >
        {!readOnly && changes.length > 0 ? (
          <Button
            label={pending ? "Saving…" : "Save marks"}
            variant="primary"
            size="lg"
            onClick={save}
            isLoading={pending}
            icon={<Icon icon={Check} size="sm" />}
          />
        ) : saved ? (
          <Button
            label="Done, back to Today"
            variant="primary"
            size="lg"
            href={doneHref}
            icon={<Icon icon={Check} size="sm" />}
          />
        ) : (
          <Button
            label="Back to Today"
            variant="secondary"
            size="lg"
            href={doneHref}
            icon={<Icon icon={ChevronLeft} size="sm" />}
          />
        )}
      </SaveBar>
    </VStack>
  );
}
