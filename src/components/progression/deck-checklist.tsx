"use client";
import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemContent, ItemGroup } from "@/components/shadcn/item";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Label } from "@/components/shadcn/label";
import {
  MarkChoices,
  TeachingNotice,
} from "@/components/instructor/teaching-ui";
import { SaveBar } from "@/components/attendance/register-form";
import {
  SAVE_TIMEOUT_MS,
  SAVE_UNCONFIRMED_MESSAGE,
  withTimeout,
} from "@/lib/save-feedback";
import type {
  AttendanceStatus,
  CompetencyStatus,
} from "@/generated/prisma/client";
import {
  saveClassAssessment,
  saveInstructorAssessment,
} from "@/lib/progression/actions/assess";
import { toast } from "@/lib/toast";

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
type Marks = Map<string, Map<string, Choice>>;
type Stored = Record<string, Record<string, Choice>>;

function storageKey(courseId: string, date: string) {
  return `swimly:assess:${courseId}:${date}`;
}

export function DeckChecklist(
  props: React.ComponentProps<typeof DeckChecklistState>,
) {
  return (
    <DeckChecklistState
      key={`${props.courseId}:${props.date}:${props.levelId}`}
      {...props}
    />
  );
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
  doneLabel = "Today",
  teaching = false,
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
  doneLabel?: string;
  teaching?: boolean;
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
            if (
              copy.has(competencyId) &&
              (status === null ||
                status === "WORKING_ON" ||
                status === "ACHIEVED")
            )
              copy.set(competencyId, status);
          }
          next.set(studentId, copy);
        }
        return next;
      });
      setRestored(true);
      setDirty(true);
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        setStorageUnavailable(true);
      }
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
          teaching
            ? saveInstructorAssessment({
                courseId,
                date,
                levelId,
                marks: changes,
              })
            : saveClassAssessment({ levelId, marks: changes }),
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

  if (competencies.length === 0)
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-ui-muted-foreground">
          This level has no competencies yet.
        </p>
        <Button asChild variant="outline">
          <Link href={doneHref}>Back to {doneLabel}</Link>
        </Button>
      </div>
    );
  const currentIndex = Math.min(current, competencies.length - 1),
    competency = competencies[currentIndex];
  const achievedHere = here.filter(
    (s) => marks.get(s.studentId)?.get(competency.id) === "ACHIEVED",
  ).length;
  const achievedFor = (id: string) =>
    competencies.filter((c) => marks.get(id)?.get(c.id) === "ACHIEVED").length;
  const markedAtAll = [...marks.values()].some((row) =>
    [...row.values()].some(Boolean),
  );
  const row = (swimmer: DeckSwimmer, dimmed: boolean) => (
    <Item
      key={swimmer.studentId}
      role="listitem"
      className={
        "items-center rounded-none px-0 py-4" +
        (dimmed ? " text-ui-muted-foreground" : "")
      }
    >
      <ItemContent className="min-w-0 basis-48">
        <p className="text-base font-semibold">{swimmer.name}</p>
        <p className="text-sm text-ui-muted-foreground">
          {achievedFor(swimmer.studentId)} of {competencies.length} achieved
          {swimmer.completed ? " · Level complete" : ""}
          {swimmer.offLevel ? " · Placed at another level" : ""}
          {attendance?.[swimmer.studentId] === "LATE" ? " · Late" : ""}
        </p>
      </ItemContent>
      <MarkChoices
        label={competency.name + " — " + swimmer.name}
        value={marks.get(swimmer.studentId)?.get(competency.id) ?? "WORKING_ON"}
        options={[
          { value: "WORKING_ON", label: MARK_LABEL.WORKING_ON },
          { value: "ACHIEVED", label: MARK_LABEL.ACHIEVED },
        ]}
        disabled={readOnly || pending}
        onChange={(next) =>
          choose(swimmer.studentId, competency.id, next as CompetencyStatus)
        }
      />
    </Item>
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="competency-picker">Competency</Label>
        <Select
          value={String(currentIndex)}
          onValueChange={(next) => setCurrent(Number(next))}
        >
          <SelectTrigger
            id="competency-picker"
            className="min-h-11 w-full max-w-xl"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {competencies.map((c, index) => (
              <SelectItem className="min-h-11" key={c.id} value={String(index)}>
                {index + 1}. {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <section
        aria-labelledby="deck-competency"
        className="flex flex-col gap-4 rounded-ui-lg border border-ui-border bg-ui-muted/40 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-ui-muted-foreground">
              Competency {currentIndex + 1} of {competencies.length}
            </p>
            <h2 id="deck-competency" className="text-xl font-semibold">
              {competency.name}
            </h2>
            {competency.description ? (
              <p className="max-w-prose text-sm text-ui-muted-foreground">
                {competency.description}
              </p>
            ) : null}
            <p className="text-sm text-ui-muted-foreground" aria-live="polite">
              {achievedHere} of {here.length}
              {attendance ? " in today" : ""} achieved
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous competency"
              disabled={currentIndex === 0}
              onClick={() => setCurrent(Math.max(0, currentIndex - 1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next competency"
              disabled={currentIndex === competencies.length - 1}
              onClick={() =>
                setCurrent(Math.min(competencies.length - 1, currentIndex + 1))
              }
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
        {!readOnly && here.length ? (
          <Button
            variant="outline"
            className="self-start whitespace-normal"
            disabled={pending}
            onClick={() => everyone(competency.id, "ACHIEVED")}
          >
            <Check aria-hidden="true" />
            {attendance ? "Everyone in today achieved" : "Everyone achieved"}
          </Button>
        ) : null}
      </section>
      {here.length ? (
        <ItemGroup className="divide-y divide-ui-border">
          {here.map((s) => row(s, false))}
        </ItemGroup>
      ) : (
        <p className="text-ui-muted-foreground">
          {swimmers.length
            ? "Nobody was marked in today."
            : "Nobody in this class yet."}
        </p>
      )}
      {away.length ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              Not in today ({away.length})<ChevronDown aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ItemGroup className="divide-y divide-ui-border">
              {away.map((s) => row(s, true))}
            </ItemGroup>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {error ? <TeachingNotice title={error} error /> : null}
      {storageUnavailable && !readOnly ? (
        <TeachingNotice title="This browser cannot keep a backup. Keep this tab open until marks are saved." />
      ) : null}
      <SaveBar
        status={
          changes.length
            ? restored
              ? "Restored on this device · not saved"
              : changes.length +
                " " +
                (changes.length === 1 ? "mark" : "marks") +
                " not saved yet"
            : saved
              ? "Saved"
              : markedAtAll
                ? "Up to date"
                : "Nothing marked yet"
        }
      >
        {!readOnly && changes.length ? (
          <Button disabled={pending} onClick={save}>
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {pending ? "Saving…" : "Save marks"}
          </Button>
        ) : (
          <Button asChild variant={saved ? "default" : "outline"}>
            <Link href={doneHref}>
              {saved ? (
                <Check aria-hidden="true" />
              ) : (
                <ChevronLeft aria-hidden="true" />
              )}
              {saved ? "Done, back to " : "Back to "}
              {doneLabel}
            </Link>
          </Button>
        )}
      </SaveBar>
    </div>
  );
}
