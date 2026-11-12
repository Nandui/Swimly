"use client";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { confirmLevelCompletion } from "@/modules/activities/shared/progression/actions/assess";

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
            placeholder="Assessed in open water instead, so the pool test does not apply"
          />
        </Field>
      )}
      <Field label="Anything worth noting" htmlFor="note">
        <Textarea id="note" name="note" rows={2} />
      </Field>
    </FormDialog>
  );
}

