"use client";

import { Field, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { handleStrike, withdrawStrike } from "@/modules/staffing/features/strikes/server/actions";
import { checked, text, THEME, useRefresh } from "@/modules/staffing/shared/components/kit";
import { STRIKE_STAGE_META, type StrikeStage } from "@/modules/staffing/shared/rules";

const ACT: Record<StrikeStage, { button: string; title: string; hint: string }> = {
  not_counted: { button: "Record", title: "Record a note", hint: "Settling in: logged, not counted." },
  informal_1: { button: "Record chat", title: "Return-to-work chat", hint: "Informal counselling on their next shift: what happened and what is expected." },
  informal_2: { button: "Record note", title: "Second informal conversation", hint: "A written note of the conversation, signed by both of you." },
  formal_referral: { button: "Record referral", title: "Refer for formal investigation", hint: "Strike 3: refer to HR for the formal disciplinary procedure (investigation, outcome, appeal)." },
  serious_misconduct_referral: { button: "Record referral", title: "Refer for possible serious misconduct", hint: "Refer to HR now. Say what was found and who you told." },
};

/** Record the owner's step for a strike (BR-8.3). */
export function HandleStrike({ id, name, stage }: { id: string; name: string; stage: StrikeStage }) {
  const refresh = useRefresh();
  const act = ACT[stage];
  return (
    <FormDialog portalClassName={THEME} trigger={<Button variant="outline">{act.button}</Button>} title={`${act.title}: ${name}`} description={STRIKE_STAGE_META[stage].label}
      submitLabel="Save" successMessage="Recorded" onSuccess={refresh}
      submit={(fd) => handleStrike(id, { note: text(fd, "note"), signedByBoth: checked(fd, "signed") })}>
      <Field label="What was said or done" htmlFor={`stf-strike-${id}`} hint={act.hint}>
        <Textarea id={`stf-strike-${id}`} name="note" required minLength={3} maxLength={2000} />
      </Field>
      {stage === "informal_2" ? <Label className="flex min-h-11 items-center gap-3"><Checkbox name="signed" />The note is signed by both of us</Label> : null}
    </FormDialog>
  );
}

/** Withdraw a strike logged in error (Manage), with a reason. It stays on record. */
export function WithdrawStrike({ id, name }: { id: string; name: string }) {
  const refresh = useRefresh();
  return (
    <FormDialog portalClassName={THEME} destructive trigger={<Button variant="ghost">Withdraw</Button>} title={`Withdraw ${name}'s strike?`}
      description="It stays on record as withdrawn and no longer counts." submitLabel="Withdraw" successMessage="Strike withdrawn" onSuccess={refresh}
      submit={(fd) => withdrawStrike(id, text(fd, "reason"))}>
      <Field label="Why" htmlFor={`stf-wd-${id}`}><Textarea id={`stf-wd-${id}`} name="reason" required minLength={3} maxLength={500} /></Field>
    </FormDialog>
  );
}
