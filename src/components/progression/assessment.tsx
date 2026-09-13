"use client";
import { RadioGroupItem, RadioGroup } from "@/components/shadcn/radio-group";

import {
  ItemMedia,
  ItemContent,
  Item,
  ItemGroup,
} from "@/components/shadcn/item";

import { Notice } from "@/components/ui-kit/notice";
import { Button } from "@/components/shadcn/button";
import { LoadingButton } from "@/components/ui/loading-button";

import * as React from "react";
import { Check, GraduationCap, Undo2 } from "lucide-react";

import { Field, FormDialog } from "@/components/form-dialog";
import { Tag } from "@/components/ui-kit/tag";
import { Textarea } from "@/components/ui/textarea";
import type { CompetencyStatus } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";
import {
  confirmLevelCompletion,
  revokeLevelCompletion,
  saveAssessment,
} from "@/lib/progression/actions/assess";
import { toast } from "@/lib/toast";

import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import {
  COMPLETION_META,
  COMPETENCY_STATUS_META,
} from "@/lib/progression/constants";

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
  const label = competency.status === "ACHIEVED" ? "Achieved" : "Not Achieved";
  return `${label} · ${competency.assessedByName}${
    competency.assessedOn ? ` · ${formatDate(competency.assessedOn)}` : ""
  }`;
}

const MARK_LABEL: Record<CompetencyStatus, string> = {
  WORKING_ON: "Not Achieved",
  ACHIEVED: "Achieved",
};
const MARK_ORDER: CompetencyStatus[] = ["WORKING_ON", "ACHIEVED"];

/** The checklist for one swimmer at one level.
 *
 *  Batched behind one Save, like the register and for the same reason: Server
 *  Actions dispatch one at a time per client, so a save per tap would queue.
 *  Missing marks display as Not Achieved without inventing an assessment. */
export function CompetencyChecklist(
  props: React.ComponentProps<typeof CompetencyChecklistState>,
) {
  return (
    <CompetencyChecklistState
      key={`${props.studentId}:${props.levelId}`}
      {...props}
    />
  );
}

function CompetencyChecklistState({
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
    () =>
      new Map(
        competencies.map((competency) => [competency.id, competency.status]),
      ),
    [competencies],
  );
  const [marks, setMarks] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [edited, setEdited] = React.useState(false);

  // Adopt fresh server state after a save revalidates, compared during render
  // rather than resynced in an effect.
  const [syncedTo, setSyncedTo] = React.useState(initial);
  if (syncedTo !== initial) {
    setSyncedTo(initial);
    if (!edited) setMarks(initial);
  }

  const dirty = competencies.some(
    (competency) => marks.get(competency.id) !== competency.status,
  );

  function save() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveAssessment>>;
      try {
        result = await withTimeout(
          saveAssessment({
            studentId,
            levelId,
            results: [...marks.entries()].map(([competencyId, status]) => ({
              competencyId,
              status,
            })),
          }),
        );
      } catch {
        startTransition(() => setError(SAVE_UNCONFIRMED_MESSAGE));
        return;
      }
      if (result.ok) {
        toast.success("Marks saved");
        startTransition(() => {
          setError(null);
          setEdited(false);
        });
      } else {
        startTransition(() => setError(result.error));
      }
    });
  }

  if (competencies.length === 0) {
    return (
      <p className="text-sm text-ui-muted-foreground block">
        This level has no competencies yet, so there is nothing to sign off.
      </p>
    );
  }

  return (
    <div className="min-w-0 flex flex-col gap-3">
      <ItemGroup className="divide-y divide-ui-border">
        {competencies.map((competency, index) => {
          const value = marks.get(competency.id) ?? "WORKING_ON";
          return (
            <Item
              key={competency.id}
              role="listitem"
              className="items-start [overflow-wrap:anywhere]"
            >
              <ItemMedia>
                {
                  <span className="text-sm text-ui-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                }
              </ItemMedia>
              <ItemContent className="min-w-0">
                <div className="text-sm font-medium">
                  {
                    <div className="min-w-0 flex gap-2 items-center flex-wrap">
                      <Tag color={COMPETENCY_STATUS_META[value].color}>
                        {MARK_LABEL[value]}
                      </Tag>
                      <span className="text-sm text-ui-foreground">
                        {competency.name}
                      </span>
                    </div>
                  }
                </div>
                <div className="text-sm text-ui-muted-foreground">
                  {
                    <div className="min-w-0 flex flex-col gap-2">
                      {competency.description ? (
                        <span className="text-sm text-ui-muted-foreground block">
                          {competency.description}
                        </span>
                      ) : null}
                      {assessedLine(competency) ? (
                        <span className="text-sm text-ui-muted-foreground block">
                          {assessedLine(competency)}
                        </span>
                      ) : null}
                      <div className="min-w-0 flex gap-2 items-center">
                        <RadioGroup
                          value={value}
                          aria-label={`${competency.name} — ${studentName}`}
                          onValueChange={(next) => {
                            setEdited(true);
                            setMarks((previous) => {
                              const map = new Map(previous);
                              map.set(competency.id, next as CompetencyStatus);
                              return map;
                            });
                          }}
                          disabled={readOnly || pending}
                          className={
                            "inline-flex flex-wrap gap-1 rounded-ui-lg bg-ui-muted p-1"
                          }
                        >
                          {MARK_ORDER.map((status) => (
                            <RadioGroupItem
                              key={status}
                              value={status}
                              className={
                                "aspect-auto h-auto min-h-11 w-auto flex-1 bg-transparent dark:bg-transparent dark:data-[state=checked]:bg-ui-input/30 rounded-ui-md border-0 px-3 py-2 text-sm font-medium shadow-none data-[state=checked]:bg-ui-background data-[state=checked]:text-ui-foreground data-[state=checked]:shadow-sm"
                              }
                            >
                              {MARK_LABEL[status]}
                            </RadioGroupItem>
                          ))}
                        </RadioGroup>
                      </div>
                    </div>
                  }
                </div>
              </ItemContent>
            </Item>
          );
        })}
      </ItemGroup>

      {error ? <Notice title={error} tone="error"></Notice> : null}

      {readOnly ? null : (
        <div className="min-w-0 flex gap-3 items-center justify-end">
          <span aria-live="polite" className="text-sm text-ui-muted-foreground">
            {dirty ? "Not saved yet" : "Up to date"}
          </span>
          <LoadingButton
            onClick={save}
            variant="default"
            size="sm"
            disabled={!dirty}
            pending={pending}
          >
            {<Check aria-hidden={true} className="size-4 shrink-0" />}
            {"Save marks"}
          </LoadingButton>
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
  classContext,
}: {
  studentId: string;
  levelId: string;
  studentName: string;
  levelName: string;
  achieved: number;
  total: number;
  eligible: boolean;
  admin: boolean;
  classContext?: { courseId: string; date: string };
}) {
  const blocked = !eligible && !admin;

  return (
    <FormDialog
      trigger={
        <Button
          variant={eligible ? "default" : "outline"}
          size="sm"
          title={
            blocked
              ? `${studentName} has ${achieved} of ${total}. Only an admin can complete a level with gaps.`
              : undefined
          }
          disabled={blocked}
        >
          {<GraduationCap aria-hidden={true} className="size-4 shrink-0" />}
          {`Complete ${levelName}`}
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
          classContext,
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
    <Tag color={COMPLETION_META[override ? "override" : "earned"].color}>
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
          aria-label={`Take back ${studentName}'s completion of ${levelName}`}
          size="icon-sm"
          title="Take back"
        >
          {<Undo2 aria-hidden={true} className="size-4 shrink-0" />}
        </Button>
      }
      title={`Take back ${levelName}?`}
      description={`${studentName} stops counting as having completed it, which may make the level above out of sequence for them. Their assessments are untouched.`}
      submitLabel="Take it back"
      successMessage="Completion taken back"
      submit={(formData) =>
        revokeLevelCompletion(completionId, {
          reason: String(formData.get("reason") ?? ""),
        })
      }
    >
      <Field label="Why" htmlFor="reason">
        <Textarea
          id="reason"
          name="reason"
          rows={2}
          required
          placeholder="Signed off in error"
        />
      </Field>
    </FormDialog>
  );
}
