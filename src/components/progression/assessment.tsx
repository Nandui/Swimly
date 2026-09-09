"use client";

import * as React from "react";
import { Check, GraduationCap, Undo2 } from "lucide-react";
import { Banner } from "@/components/workspace/feedback";
import { Button } from "@/components/workspace/actions";
import { IconButton } from "@/components/workspace/actions";
import { Item } from "@/components/workspace/layout";
import { List } from "@/components/workspace/layout";
import { HStack, VStack } from "@/components/workspace/layout";
import { StatusDot } from "@/components/workspace/feedback";
import { Text } from "@/components/workspace/typography";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/workspace/choices";
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
import { Icon } from "@/components/workspace/misc";
import { SAVE_UNCONFIRMED_MESSAGE, withTimeout } from "@/lib/save-feedback";
import { COMPLETION_META } from "@/lib/progression/constants";

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
  return `${label} · ${competency.assessedByName}${competency.assessedOn ? ` · ${formatDate(competency.assessedOn)}` : ""
    }`;
}

const MARK_LABEL: Record<CompetencyStatus, string> = {
  WORKING_ON: "Not Achieved",
  ACHIEVED: "Achieved",
};
const MARK_ORDER: CompetencyStatus[] = ["WORKING_ON", "ACHIEVED"];
const DOT: Record<CompetencyStatus, "success" | "warning"> = {
  WORKING_ON: "warning",
  ACHIEVED: "success",
};

/** The checklist for one swimmer at one level.
 *
 *  Batched behind one Save, like the register and for the same reason: Server
 *  Actions dispatch one at a time per client, so a save per tap would queue.
 *  Missing marks display as Not Achieved without inventing an assessment. */
export function CompetencyChecklist(props: React.ComponentProps<typeof CompetencyChecklistState>) {
  return <CompetencyChecklistState key={`${props.studentId}:${props.levelId}`} {...props} />;
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
        result = await withTimeout(saveAssessment({
          studentId,
          levelId,
          results: [...marks.entries()].map(([competencyId, status]) => ({
            competencyId,
            status,
          })),
        }));
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
      <Text as="p" display="block" color="secondary">
        This level has no competencies yet, so there is nothing to sign off.
      </Text>
    );
  }

  return (
    <VStack gap={3}>
      <List hasDividers>
        {competencies.map((competency, index) => {
          const value = marks.get(competency.id) ?? "WORKING_ON";
          return (
            <Item
              key={competency.id}
              as="li"
              align="start"
              marker={
                <Text type="supporting" hasTabularNumbers>
                  {index + 1}
                </Text>
              }
              label={
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <StatusDot
                    variant={DOT[value]}
                    label={MARK_LABEL[value]}
                  />
                  <Text>{competency.name}</Text>
                </HStack>
              }
              description={
                <VStack gap={2}>
                  {competency.description ? (
                    <Text type="supporting" display="block">
                      {competency.description}
                    </Text>
                  ) : null}
                  {assessedLine(competency) ? (
                    <Text type="supporting" display="block">
                      {assessedLine(competency)}
                    </Text>
                  ) : null}
                  <HStack>
                    <SegmentedControl
                      label={`${competency.name} — ${studentName}`}
                      size="md"
                      value={value}
                      isDisabled={readOnly || pending}
                      onChange={(next) => {
                        setEdited(true);
                        setMarks((previous) => {
                          const map = new Map(previous);
                          map.set(competency.id, next as CompetencyStatus);
                          return map;
                        });
                      }}
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
        })}
      </List>

      {error ? (
        <Banner status="error" title={error} collapsible={false} />
      ) : null}

      {readOnly ? null : (
        <HStack gap={3} vAlign="center" hAlign="end">
          <Text type="supporting" aria-live="polite">
            {dirty ? "Not saved yet" : "Up to date"}
          </Text>
          <Button
            label="Save marks"
            variant="primary"
            size="sm"
            onClick={save}
            isLoading={pending}
            isDisabled={!dirty}
            icon={<Icon icon={Check} size="sm" />}
          />
        </HStack>
      )}
    </VStack>
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
          label={`Complete ${levelName}`}
          size="sm"
          variant={eligible ? "primary" : "secondary"}
          isDisabled={blocked}
          tooltip={
            blocked
              ? `${studentName} has ${achieved} of ${total}. Only an admin can complete a level with gaps.`
              : undefined
          }
          icon={<Icon icon={GraduationCap} size="sm" />}
        />
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
        <IconButton
          label={`Take back ${studentName}'s completion of ${levelName}`}
          tooltip="Take back"
          variant="ghost"
          size="sm"
          icon={<Icon icon={Undo2} size="sm" />}
        />
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
