"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, GraduationCap, Loader2, Undo2 } from "lucide-react";
import { Field, FormDialog } from "@/components/form-dialog";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CompetencyStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";
import {
  confirmLevelCompletion,
  revokeLevelCompletion,
  saveAssessment,
} from "@/lib/progression/actions/assess";
import { cn } from "@/lib/utils";

type Choice = CompetencyStatus | null;

type Competency = {
  id: string;
  name: string;
  description?: string | null;
  status: Choice;
  /** Who last set the mark, and when — what the record says, whatever is
   *  being tapped now. Every save stamps the instructor saving it. */
  assessedByName?: string | null;
  assessedOn?: Date | null;
};

/** "Achieved · Ella O'Brien · 2 Sept 2026": the mark as it stands on the
 *  record, with the instructor who made it. */
export function assessedLine(competency: Competency): string | null {
  if (!competency.status || !competency.assessedByName) return null;
  const label = competency.status === "ACHIEVED" ? "Achieved" : "Working on it";
  return `${label} · ${competency.assessedByName}${
    competency.assessedOn ? ` · ${formatDate(competency.assessedOn)}` : ""
  }`;
}

const CHOICES: { value: Choice; label: string; className: string }[] = [
  {
    value: null,
    label: "Not yet",
    className: "bg-secondary text-muted-foreground border-secondary",
  },
  {
    value: "WORKING_ON",
    label: "Working on it",
    className: "bg-(--tag-yellow-bg) text-(--tag-yellow-fg) border-(--tag-yellow-bg)",
  },
  {
    value: "ACHIEVED",
    label: "Achieved",
    className: "bg-(--tag-green-bg) text-(--tag-green-fg) border-(--tag-green-bg)",
  },
];

/** The checklist for one swimmer at one level.
 *
 *  Batched behind one Save, like the register and for the same reason: Server
 *  Actions dispatch one at a time per client, so a save per tap would queue. */
export function CompetencyChecklist({
  studentId,
  levelId,
  studentName,
  competencies,
  readOnly,
}: {
  studentId: string;
  levelId: string;
  studentName: string;
  competencies: Competency[];
  readOnly: boolean;
}) {
  const initial = React.useMemo(
    () => new Map(competencies.map((competency) => [competency.id, competency.status])),
    [competencies]
  );
  const [marks, setMarks] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Adopt fresh server state after a save revalidates, compared during render
  // rather than resynced in an effect.
  const [syncedTo, setSyncedTo] = React.useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    setMarks(initial);
  }

  const dirty = competencies.some(
    (competency) => marks.get(competency.id) !== competency.status
  );

  function save() {
    startTransition(async () => {
      const result = await saveAssessment({
        studentId,
        levelId,
        results: [...marks.entries()].map(([competencyId, status]) => ({ competencyId, status })),
      });
      if (result.ok) {
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
        This level has no competencies yet, so there is nothing to sign off.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="overflow-hidden rounded-md border">
        {competencies.map((competency, index) => {
          const value = marks.get(competency.id) ?? null;
          return (
            <li key={competency.id} className="border-b p-3 last:border-0">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    {competency.name}
                  </p>
                  {competency.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{competency.description}</p>
                  ) : null}
                  {assessedLine(competency) ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{assessedLine(competency)}</p>
                  ) : null}
                </div>

                <div
                  role="group"
                  aria-label={`${competency.name} — ${studentName}`}
                  className="flex w-full gap-1 sm:w-auto"
                >
                  {CHOICES.map((choice) => {
                    const active = value === choice.value;
                    return (
                      <button
                        key={choice.label}
                        type="button"
                        disabled={readOnly}
                        aria-pressed={active}
                        aria-label={`${choice.label} — ${competency.name}`}
                        onClick={() =>
                          setMarks((previous) => {
                            const next = new Map(previous);
                            next.set(competency.id, choice.value);
                            return next;
                          })
                        }
                        className={cn(
                          "h-10 flex-1 rounded-md border px-2 text-[13px] font-medium transition-colors sm:h-8 sm:w-28 sm:flex-none",
                          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          "disabled:pointer-events-none disabled:opacity-60",
                          active
                            ? choice.className
                            : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p
          role="alert"
          className="rounded bg-(--tag-red-bg) px-2.5 py-1.5 text-[13px] text-(--tag-red-fg)"
        >
          {error}
        </p>
      ) : null}

      {readOnly ? null : (
        <div className="flex items-center justify-end gap-3">
          <p className="text-xs text-muted-foreground">{dirty ? "Not saved yet" : "Up to date"}</p>
          <Button type="button" size="sm" onClick={save} disabled={pending || !dirty}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save marks
          </Button>
        </div>
      )}
    </div>
  );
}

/** The deliberate second step. Signing off the last competency makes a swimmer
 *  *eligible*; somebody still has to say they are done. */
export function ConfirmLevel({
  studentId,
  levelId,
  studentName,
  levelName,
  achieved,
  total,
  eligible,
  admin,
}: {
  studentId: string;
  levelId: string;
  studentName: string;
  levelName: string;
  achieved: number;
  total: number;
  eligible: boolean;
  admin: boolean;
}) {
  const blocked = !eligible && !admin;

  return (
    <FormDialog
      trigger={
        <Button
          size="sm"
          variant={eligible ? "default" : "outline"}
          disabled={blocked}
          title={
            blocked
              ? `${studentName} has ${achieved} of ${total}. Only an admin can complete a level with gaps.`
              : undefined
          }
        >
          <GraduationCap className="size-4" />
          Complete {levelName}
        </Button>
      }
      title={`Complete ${levelName} for ${studentName}?`}
      description={
        eligible
          ? `All ${total} competencies are signed off. This goes on their record with today's date.`
          : `${achieved} of ${total} are signed off. Completing anyway overrides the curriculum, so it needs a reason and it is recorded as an override.`
      }
      submitLabel="Confirm completion"
      successMessage="Level completed"
      submit={(formData) =>
        confirmLevelCompletion({
          studentId,
          levelId,
          note: String(formData.get("note") ?? ""),
          overrideReason: String(formData.get("overrideReason") ?? ""),
        })
      }
    >
      {eligible ? null : (
        <Field
          label="Why complete it with gaps"
          htmlFor="overrideReason"
          hint="Stored on the record, not only in the log."
        >
          <Textarea
            id="overrideReason"
            name="overrideReason"
            rows={2}
            required
            placeholder="Assessed in open water instead — the pool test does not apply"
          />
        </Field>
      )}
      <Field label="Anything worth noting" htmlFor="note">
        <Textarea id="note" name="note" rows={2} />
      </Field>
    </FormDialog>
  );
}

export function CompletionTag({
  achieved,
  total,
  override,
}: {
  achieved: number;
  total: number;
  override: string | null;
}) {
  return (
    <Tag color={override ? "orange" : "green"}>
      {override ? `Completed with gaps · ${achieved}/${total}` : "Completed"}
    </Tag>
  );
}

export function RevokeCompletion({
  completionId,
  studentName,
  levelName,
}: {
  completionId: string;
  studentName: string;
  levelName: string;
}) {
  return (
    <FormDialog
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Take back ${studentName}'s completion of ${levelName}`}
        >
          <Undo2 className="size-3.5" />
        </Button>
      }
      title={`Take back ${levelName}?`}
      description={`${studentName} stops counting as having completed it, which may make the level above out of sequence for them. Their assessments are untouched.`}
      submitLabel="Take it back"
      successMessage="Completion taken back"
      submit={(formData) =>
        revokeLevelCompletion(completionId, { reason: String(formData.get("reason") ?? "") })
      }
    >
      <Field label="Why" htmlFor="reason">
        <Textarea id="reason" name="reason" rows={2} required placeholder="Signed off in error" />
      </Field>
    </FormDialog>
  );
}
