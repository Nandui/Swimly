"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import type { CompetencyStatus } from "@/generated/prisma/client";
import { saveClassAssessment } from "@/lib/progression/actions/assess";
import { cn } from "@/lib/utils";

/** The checklist as the deck uses it: one competency at a time, across the
 *  whole class.
 *
 *  A lesson works like that — the instructor runs a drill, then marks who
 *  got it — so the competency is the unit of the moment and the swimmers
 *  are the list. Each swimmer is one row with two big buttons; a second tap
 *  on the same button takes the mark back. Every change across every
 *  competency sits behind one Save, mirrored to `localStorage` so a
 *  dropped connection or a closed tab loses nothing. The per-swimmer
 *  checklist still exists on the class's assessment page for the desk. */

type Choice = CompetencyStatus | null;

export type DeckCompetency = { id: string; name: string; description: string | null };

export type DeckSwimmer = {
  studentId: string;
  name: string;
  offLevel: boolean;
  completed: boolean;
  marks: Record<string, Choice>;
};

const MARK_META: Record<CompetencyStatus, { label: string; active: string }> = {
  WORKING_ON: {
    label: "Working on it",
    active: "border-(--tag-yellow-bg) bg-(--tag-yellow-bg) text-(--tag-yellow-fg)",
  },
  ACHIEVED: {
    label: "Achieved",
    active: "border-(--tag-green-bg) bg-(--tag-green-bg) text-(--tag-green-fg)",
  },
};
const MARK_ORDER: CompetencyStatus[] = ["WORKING_ON", "ACHIEVED"];

type Marks = Map<string, Map<string, Choice>>;
type Stored = Record<string, Record<string, Choice>>;

function storageKey(courseId: string, date: string) {
  return `swimly:assess:${courseId}:${date}`;
}

export function DeckChecklist({
  courseId,
  date,
  levelId,
  competencies,
  swimmers,
  readOnly,
  doneHref,
}: {
  courseId: string;
  date: string;
  levelId: string;
  competencies: DeckCompetency[];
  swimmers: DeckSwimmer[];
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
        ])
      ),
    [swimmers, competencies]
  );

  const [marks, setMarks] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Open on the first competency the class has not all got yet.
  const [current, setCurrent] = React.useState(() => {
    const index = competencies.findIndex((c) =>
      swimmers.some((s) => (s.marks[c.id] ?? null) !== "ACHIEVED")
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
      return;
    }
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as Stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarks((previous) => {
        const next: Marks = new Map(previous);
        for (const [studentId, byCompetency] of Object.entries(stored)) {
          const row = next.get(studentId);
          if (!row) continue;
          const copy = new Map(row);
          for (const [competencyId, status] of Object.entries(byCompetency)) {
            if (copy.has(competencyId)) copy.set(competencyId, status);
          }
          next.set(studentId, copy);
        }
        return next;
      });
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key]);

  // After a save revalidates, adopt what the server now says.
  const [syncedTo, setSyncedTo] = React.useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    setMarks(initial);
  }

  const changes = React.useMemo(() => {
    const list: { studentId: string; competencyId: string; status: Choice }[] = [];
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
      // Storage blocked: the marks still live in the tab until saved.
    }
  }

  function update(mutate: (next: Marks) => void) {
    setMarks((previous) => {
      const next: Marks = new Map();
      for (const [studentId, row] of previous) next.set(studentId, new Map(row));
      mutate(next);
      remember(next);
      return next;
    });
  }

  /** Tap to set; tap the same one again to take it back. */
  function toggle(studentId: string, competencyId: string, status: CompetencyStatus) {
    update((next) => {
      const row = next.get(studentId);
      if (!row) return;
      row.set(competencyId, row.get(competencyId) === status ? null : status);
    });
  }

  function everyone(competencyId: string, status: CompetencyStatus) {
    update((next) => {
      for (const row of next.values()) row.set(competencyId, status);
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveClassAssessment({ levelId, marks: changes });
      if (result.ok) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Nothing to clear.
        }
        toast.success("Marks saved");
        startTransition(() => setError(null));
      } else {
        startTransition(() => setError(result.error));
      }
    });
  }

  if (competencies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This level has no competencies yet, so there is nothing to mark.
      </p>
    );
  }

  const competency = competencies[current];
  const achievedHere = swimmers.filter(
    (s) => marks.get(s.studentId)?.get(competency.id) === "ACHIEVED"
  ).length;
  const allAchieved = (competencyId: string) =>
    swimmers.length > 0 &&
    swimmers.every((s) => marks.get(s.studentId)?.get(competencyId) === "ACHIEVED");
  const achievedFor = (studentId: string) =>
    competencies.filter((c) => marks.get(studentId)?.get(c.id) === "ACHIEVED").length;

  const focusRing =
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

  return (
    <div className="space-y-4">
      {/* Every competency, one number each: where you are and what is
          already done. Bleeds to the screen edge on a phone so the row
          scrolls under the thumb instead of clipping. */}
      <div
        role="group"
        aria-label="Competencies"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
      >
        {competencies.map((c, index) => {
          const active = index === current;
          const done = allAchieved(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-label={`${index + 1}. ${c.name}`}
              aria-current={active ? "true" : undefined}
              onClick={() => setCurrent(index)}
              className={cn(
                "inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-md border px-3 text-sm font-medium tabular-nums transition-colors",
                focusRing,
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-(--tag-green-bg) bg-(--tag-green-bg) text-(--tag-green-fg)"
                    : "border-input bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {index + 1}
              {done && !active ? <Check aria-hidden="true" className="size-3.5" /> : null}
            </button>
          );
        })}
      </div>

      <section
        aria-labelledby="deck-competency"
        className="rounded-md border bg-sidebar p-3 sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground tabular-nums">
              Competency {current + 1} of {competencies.length}
            </p>
            <h2 id="deck-competency" className="text-lg font-semibold text-foreground">
              {competency.name}
            </h2>
            {competency.description ? (
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                {competency.description}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{achievedHere}</span> of{" "}
              <span className="tabular-nums">{swimmers.length}</span> achieved
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Previous competency"
              disabled={current === 0}
              onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Next competency"
              disabled={current === competencies.length - 1}
              onClick={() => setCurrent((i) => Math.min(competencies.length - 1, i + 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        {readOnly || swimmers.length === 0 ? null : (
          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => everyone(competency.id, "ACHIEVED")}
            >
              Everyone achieved
            </Button>
          </div>
        )}
      </section>

      {swimmers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody in this class yet.</p>
      ) : (
        <ul className="overflow-hidden rounded-md border">
          {swimmers.map((swimmer) => {
            const value = marks.get(swimmer.studentId)?.get(competency.id) ?? null;
            return (
              <li key={swimmer.studentId} className="border-b p-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                      {swimmer.name}
                      {swimmer.completed ? <Tag color="blue">Completed</Tag> : null}
                      {swimmer.offLevel ? <Tag color="purple">Placed at another level</Tag> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {achievedFor(swimmer.studentId)} of {competencies.length} achieved
                    </p>
                  </div>

                  <div
                    role="group"
                    aria-label={`${competency.name} — ${swimmer.name}`}
                    className="flex w-full gap-1.5 sm:w-auto"
                  >
                    {MARK_ORDER.map((status) => {
                      const active = value === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={readOnly}
                          aria-pressed={active}
                          aria-label={`${MARK_META[status].label} — ${swimmer.name}`}
                          onClick={() => toggle(swimmer.studentId, competency.id, status)}
                          className={cn(
                            "h-11 flex-1 rounded-md border text-sm font-medium transition-colors sm:h-9 sm:w-32 sm:flex-none",
                            focusRing,
                            "disabled:pointer-events-none disabled:opacity-60",
                            active
                              ? MARK_META[status].active
                              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          {MARK_META[status].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded bg-(--tag-red-bg) px-2.5 py-1.5 text-[13px] text-(--tag-red-fg)"
        >
          {error}
        </p>
      ) : null}

      {/* One bar, one button: Save while there is something to save, Done
          once there is not. Clears the home indicator on a phone. */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-8 md:px-8">
        <p className="text-xs text-muted-foreground tabular-nums">
          {changes.length > 0
            ? `${changes.length} ${changes.length === 1 ? "mark" : "marks"} not saved yet`
            : "Up to date"}
        </p>
        {!readOnly && changes.length > 0 ? (
          <Button type="button" size="lg" onClick={save} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="size-4" />
                Save marks
              </>
            )}
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href={doneHref}>
              <Check className="size-4" />
              Done, back to Today
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
