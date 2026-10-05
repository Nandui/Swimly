"use client";
import * as React from "react";
import Link from "next/link";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
} from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
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
import { MarkChoices } from "@/modules/activities/components/instructor/teaching-ui";
import { Notice } from "@/components/ui-kit/notice";
import { SaveBar } from "@/modules/activities/components/attendance/register-form";
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
} from "@/modules/activities/lib/progression/actions/assess";
import { toast } from "@/lib/toast";
import { CompleteLevel } from "@/modules/activities/components/instructor/complete-level";
import { MoveReadinessStatus, moveReadinessMeta } from "@/modules/activities/components/instructor/move-readiness-status";
import { ASSESSMENT_CHOICES, COMPETENCY_STATUS_META } from "@/modules/activities/lib/progression/constants";

/** The two marks, in the words every competency screen uses ("Not achieved", "Achieved"). */
const MARK_OPTIONS = ASSESSMENT_CHOICES.map((value) => ({ value, label: COMPETENCY_STATUS_META[value].label }));
const VIEWS = [{ value: "swimmer", label: "By swimmer" }, { value: "competency", label: "By competency" }] as const;

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
  readyToMoveAt?: Date | null;
  readyToMoveByName?: string | null;
  moveReadinessCurrent?: boolean;
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
  moveReadiness,
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
  /** Supplied only when the instructor can confirm this level's completion. */
  moveReadiness?: { levelName: string };
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
  const [expandedSwimmer, setExpandedSwimmer] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"swimmer" | "competency">("swimmer");
  const [showAbsent, setShowAbsent] = React.useState(false);
  const bySwimmer = teaching && view === "swimmer";

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

  function achieveAllFor(studentId: string) {
    update((next) => {
      const swimmerMarks = next.get(studentId);
      for (const competency of competencies)
        swimmerMarks?.set(competency.id, "ACHIEVED");
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
            : saveClassAssessment({ levelId, marks: changes, classContext: { courseId, date } }),
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
      <section className="pc-panel" aria-label="Competencies">
        <EmptyState
          icon="clipboardList"
          title="This level has no competencies yet."
          action={
            <Button asChild variant="outline">
              <Link href={doneHref}><ChevronLeft aria-hidden="true" />Back to {doneLabel}</Link>
            </Button>
          }
        />
      </section>
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
  const progressLabel = (swimmer: DeckSwimmer) =>
    [
      `${achievedFor(swimmer.studentId)} of ${competencies.length} achieved`,
      swimmer.completed ? "Level complete" : null,
      swimmer.offLevel ? "Placed at another level" : null,
      attendance?.[swimmer.studentId] === "LATE" ? "Late" : null,
    ].filter(Boolean).join(" · ");
  const avatar = (name: string) => (
    <Avatar size="lg" aria-hidden="true"><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
  );
  const swimmerRow = (swimmer: DeckSwimmer, dimmed: boolean) => {
    const open = expandedSwimmer === swimmer.studentId;
    const allAchieved = achievedFor(swimmer.studentId) === competencies.length;
    const allSaved = competencies.every((item) => swimmer.marks[item.id] === "ACHIEVED");
    const readinessAvailable = teaching && !readOnly && moveReadiness;
    return (
      <Collapsible
        key={swimmer.studentId}
        open={open}
        onOpenChange={(next) => setExpandedSwimmer(next ? swimmer.studentId : null)}
        asChild
      >
        <li className="pc-row" data-muted={dimmed ? "" : undefined}>
          {/* One tab stop per row: the whole head is the trigger; the chevron only shows it. */}
          <h3 className="flex min-w-0 basis-full">
            <CollapsibleTrigger className="pc-row-toggle">
              {avatar(swimmer.name)}
              <span className="pc-row-body">
                <span className="pc-row-title break-words">{swimmer.name}</span>
                <span className="pc-row-hint">{progressLabel(swimmer)}</span>
              </span>
              <span className="pc-row-trail">
                {swimmer.readyToMoveAt ? <Tag meta={moveReadinessMeta(Boolean(swimmer.moveReadinessCurrent))} /> : null}
                <span className="pc-row-toggle-icon" aria-hidden="true"><ChevronDown /></span>
              </span>
            </CollapsibleTrigger>
          </h3>
          <CollapsibleContent className="basis-full">
          <div role="region" aria-label={`${swimmer.name} competencies`} className="flex flex-col gap-3">
            {open && !readOnly ? (
              <Button
                variant="outline"
                className="self-end"
                disabled={pending || allAchieved}
                onClick={() => achieveAllFor(swimmer.studentId)}
                aria-label={`Mark all achieved for ${swimmer.name}`}
              >
                <CheckCheck aria-hidden="true" />Mark all achieved
              </Button>
            ) : null}
            {dimmed ? <p className="pc-row-hint">Not in today. These are their recorded competencies.</p> : null}
            <ol className="pc-rows">
              {competencies.map((item, index) => (
                <li key={item.id} className="pc-row">
                  <span className="pc-tile-icon font-semibold" aria-hidden="true">{index + 1}</span>
                  <div className="pc-row-body">
                    <p className="pc-row-title break-words">{item.name}</p>
                    {item.description ? <p className="pc-row-hint max-w-prose">{item.description}</p> : null}
                  </div>
                  <MarkChoices
                    label={item.name + " — " + swimmer.name}
                    value={marks.get(swimmer.studentId)?.get(item.id) ?? "WORKING_ON"}
                    options={MARK_OPTIONS}
                    disabled={readOnly || pending}
                    onChange={(next) => choose(swimmer.studentId, item.id, next as CompetencyStatus)}
                  />
                </li>
              ))}
            </ol>
            {readinessAvailable && (swimmer.readyToMoveAt || allAchieved) ? (
              <div className="pc-note flex-col items-start gap-3">
                {swimmer.readyToMoveAt ? (
                  <MoveReadinessStatus
                    studentId={swimmer.studentId}
                    studentName={swimmer.name}
                    courseId={courseId}
                    date={date}
                    current={Boolean(swimmer.moveReadinessCurrent)}
                    confirmedBy={swimmer.readyToMoveByName ?? null}
                    confirmedAt={swimmer.readyToMoveAt}
                  />
                ) : null}
                {allAchieved && !allSaved ? (
                  <p className="flex items-start gap-3">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Save marks to confirm {swimmer.name} is ready to move.
                  </p>
                ) : allAchieved && allSaved && !swimmer.moveReadinessCurrent ? (
                  <>
                    <p>
                      All competencies in {moveReadiness.levelName} are achieved and saved.
                      Confirm when {swimmer.name} is ready for their next class.
                    </p>
                    <CompleteLevel
                      studentId={swimmer.studentId}
                      studentName={swimmer.name}
                      courseId={courseId}
                      date={date}
                      levelId={levelId}
                      levelName={moveReadiness.levelName}
                      disabled={pending}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          </CollapsibleContent>
        </li>
      </Collapsible>
    );
  };
  const row = (swimmer: DeckSwimmer, dimmed: boolean) => (
    <li key={swimmer.studentId} className="pc-row" data-muted={dimmed ? "" : undefined}>
      {avatar(swimmer.name)}
      <div className="pc-row-body">
        <p className="pc-row-title break-words">{swimmer.name}</p>
        <p className="pc-row-hint">{progressLabel(swimmer)}</p>
      </div>
      <MarkChoices
        label={competency.name + " — " + swimmer.name}
        value={marks.get(swimmer.studentId)?.get(competency.id) ?? "WORKING_ON"}
        options={MARK_OPTIONS}
        disabled={readOnly || pending}
        onChange={(next) =>
          choose(swimmer.studentId, competency.id, next as CompetencyStatus)
        }
      />
    </li>
  );
  const list = (people: DeckSwimmer[], dimmed: boolean, label: string) => (
    <ul className="pc-rows" aria-label={label}>
      {people.map((s) => (bySwimmer ? swimmerRow(s, dimmed) : row(s, dimmed)))}
    </ul>
  );
  return (
    <>
    <section className="pc-panel" aria-label="Competencies">
      {teaching ? (
        // Two views of one draft: plain toggle buttons (aria-pressed), not radios, so each is
        // one press with Enter or Space.
        <div className="pc-seg pc-seg-fill-phone" role="group" aria-label="Competency view">
          {VIEWS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              className="pc-seg-item"
              aria-pressed={view === option.value}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : null}
      {!bySwimmer ? <>
      {!teaching ? (
      <div className="flex flex-col gap-2">
        <Label htmlFor="competency-picker">Competency</Label>
        <Select
          value={String(currentIndex)}
          onValueChange={(next) => setCurrent(Number(next))}
        >
          <SelectTrigger
            id="competency-picker"
            className="w-full max-w-xl"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {competencies.map((c, index) => (
              <SelectItem key={c.id} value={String(index)}>
                {index + 1}. {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      ) : null}
      <div className="pc-panel-head items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="pc-row-hint">
            Competency {currentIndex + 1} of {competencies.length}
          </p>
          <h2 id="deck-competency" className="break-words">
            {competency.name}
          </h2>
          {competency.description ? (
            <p className="pc-row-hint max-w-prose">
              {competency.description}
            </p>
          ) : null}
          <p className="pc-row-hint" aria-live="polite">
            {achievedHere} of {here.length}
            {attendance ? " in today" : ""} achieved
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
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
          <CheckCheck aria-hidden="true" />
          {attendance ? "Everyone in today achieved" : "Everyone achieved"}
        </Button>
      ) : null}
      </> : <h2 className="sr-only">Swimmer competencies</h2>}
      {here.length ? (
        list(here, false, bySwimmer ? "Swimmers in today" : `${competency.name} marks`)
      ) : (
        <EmptyState
          compact
          icon="users"
          title={swimmers.length ? "Nobody was marked in today." : "Nobody in this class yet."}
        />
      )}
      {away.length ? (
        <Collapsible open={showAbsent} onOpenChange={setShowAbsent} className="group/away flex flex-col gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="link" className="self-start">
              <ChevronDown className="transition-transform group-data-[state=open]/away:rotate-180" aria-hidden="true" />
              Not in today ({away.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {list(away, true, "Swimmers not in today")}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      {storageUnavailable && !readOnly ? (
        <Notice tone="warning" title="This browser cannot keep a backup. Keep this tab open until marks are saved." />
      ) : null}
    </section>
      <SaveBar
        status={
          changes.length
            ? restored
              ? "Restored on this device · not saved"
              : changes.length +
                " " +
                (changes.length === 1 ? "mark" : "marks") +
                " not saved yet" +
                (teaching ? " · across this class" : "")
            : saved
              ? "Saved"
              : markedAtAll
                ? "Up to date"
                : "Nothing marked yet"
        }
      >
        {!readOnly && changes.length ? (
          <LoadingButton pending={pending} onClick={save}>
            <Check aria-hidden="true" />Save marks
          </LoadingButton>
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
    </>
  );
}
