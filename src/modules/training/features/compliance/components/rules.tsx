"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { audienceInWords, DEFAULT_TIMING, type RuleAudience } from "@/modules/training/shared/rules";
import { removeTrainingRule, runTrainingRulesNow, saveTrainingRule, setTrainingRulePaused, type RuleInput } from "@/modules/training/features/compliance/server/actions";

/** Training rules (e-learning phase 4): who must take a
 *  course and how often, the buttons that change a rule, and running them now. */

type Option = { id: string; name: string };
export type RuleOptions = { roles: Option[]; departments: Option[]; sites: Option[]; positions: Option[] };
type Lists = Pick<RuleInput, "roleIds" | "departmentIds" | "siteIds" | "positionIds">;

const GROUPS: { key: keyof Lists; label: string; options: keyof RuleOptions; hint: string }[] = [
  { key: "positionIds", label: "Positions", options: "positions", hint: "For example Lifeguard or Swim teacher" },
  { key: "roleIds", label: "Roles", options: "roles", hint: "The access roles in Admin" },
  { key: "departmentIds", label: "Departments", options: "departments", hint: "People in any of these" },
  { key: "siteIds", label: "Sites", options: "sites", hint: "People who work at any of these; people at every site are included" },
];

const announced = (assigned: number) => assigned
  ? toast.success(`${assigned} ${assigned === 1 ? "person has" : "people have"} been assigned it.`)
  : toast.success("Everyone it covers already has it, or has finished it.");

/** One group of choices (positions, roles…), folded until opened. */
function Choices({ group, options, picked, onChange }: { group: (typeof GROUPS)[number]; options: Option[]; picked: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(picked.length > 0);
  if (!options.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-card bg-ui-muted">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-11 w-full justify-between">
          <span>{group.label}{picked.length ? `: ${picked.length} chosen` : ": any"}</span>
          <ChevronDown aria-hidden="true" className={open ? "rotate-180" : undefined} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        <p className="px-2 pb-2 text-xs text-ui-muted-foreground">{group.hint}. Choose none for anyone.</p>
        <div className="grid max-h-(--overlay-max-height) gap-1 overflow-y-auto sm:grid-cols-2">
          {options.map((o) => (
            <ChoiceRow key={o.id} type="checkbox" id={`rule-${group.key}-${o.id}`} title={o.name} checked={picked.includes(o.id)}
              onCheckedChange={(on) => onChange(on ? [...picked, o.id] : picked.filter((id) => id !== o.id))} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Adds a rule to a course, or changes the course's rule. Saving runs it. */
export function RuleDialog({ options, courses, rule, title }: {
  options: RuleOptions;
  /** For a new rule: the courses without one. */
  courses?: { id: string; title: string }[];
  /** For a change: the course and its rule. */
  rule?: { courseId: string; input: RuleInput };
  title?: string;
}) {
  const router = useRouter();
  const empty: Lists = { roleIds: [], departmentIds: [], siteIds: [], positionIds: [] };
  const [lists, setLists] = useState<Lists>(rule ? { roleIds: rule.input.roleIds ?? [], departmentIds: rule.input.departmentIds ?? [], siteIds: rule.input.siteIds ?? [], positionIds: rule.input.positionIds ?? [] } : empty);
  const [renews, setRenews] = useState(!!rule?.input.renewMonths);
  const maps = { roles: new Map(options.roles.map((o) => [o.id, o.name])), departments: new Map(options.departments.map((o) => [o.id, o.name])), sites: new Map(options.sites.map((o) => [o.id, o.name])), positions: new Map(options.positions.map((o) => [o.id, o.name])) };
  const reset = () => { setLists(rule ? { roleIds: rule.input.roleIds ?? [], departmentIds: rule.input.departmentIds ?? [], siteIds: rule.input.siteIds ?? [], positionIds: rule.input.positionIds ?? [] } : empty); setRenews(!!rule?.input.renewMonths); };
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={rule
        ? <Button type="button" variant="outline" className="min-h-11" aria-label={`Change the rule for ${title}`}><Pencil aria-hidden="true" /><span className="pc-only-wide">Change</span></Button>
        : <Button type="button" className="min-h-11" disabled={!courses?.length}><Plus aria-hidden="true" />Add a rule</Button>}
      title={rule ? `Rule for ${title}` : "Add a training rule"}
      description="Turnfin assigns the course to everyone the rule covers who hasn't finished it, every morning and as soon as you save. New starters get it once they are given a matching role, department, site or position."
      submitLabel={rule ? "Save and run" : "Add and run"}
      successMessage="Rule saved"
      onOpen={reset}
      onSuccess={() => router.refresh()}
      submit={async (formData) => {
        const courseId = rule?.courseId ?? String(formData.get("courseId") ?? "");
        if (!courseId) return { ok: false, error: "Choose the course." };
        const number = (name: string) => Number(formData.get(name) ?? "");
        const result = await saveTrainingRule(courseId, { ...lists, dueDays: number("dueDays"), renewMonths: renews ? number("renewMonths") : null, renewLeadDays: renews ? number("renewLeadDays") : DEFAULT_TIMING.renewLeadDays });
        if (result.ok) announced(result.assigned);
        return result.ok ? { ok: true } : result;
      }}
    >
      {!rule ? (
        <Field label="Course" htmlFor="rule-course">
          <NativeSelect id="rule-course" name="courseId" required className="min-h-11 w-full" defaultValue="">
            <NativeSelectOption value="" disabled>Choose a course</NativeSelectOption>
            {courses?.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Who must take it</legend>
        <p className="text-sm text-ui-muted-foreground" aria-live="polite">{audienceInWords(lists as RuleAudience, maps)}</p>
        {GROUPS.map((g) => <Choices key={g.key} group={g} options={options[g.options]} picked={lists[g.key] ?? []} onChange={(ids) => setLists((now) => ({ ...now, [g.key]: ids }))} />)}
      </fieldset>
      <Input id="rule-due" name="dueDays" label="Days to finish it" type="number" min={1} max={365} required defaultValue={rule?.input.dueDays ?? DEFAULT_TIMING.dueDays}
        description="Counted from the day it is assigned." />
      <Switch id="rule-renews" label="Take it again regularly" description="For refreshers and anything with an expiry, such as annual safeguarding." checked={renews} onCheckedChange={setRenews} labelSpacing="spread" />
      {renews ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="rule-renew" name="renewMonths" label="Again every (months)" type="number" min={1} max={120} required defaultValue={rule?.input.renewMonths ?? 12} />
          <Input id="rule-lead" name="renewLeadDays" label="Assign it this many days before" type="number" min={0} max={180} required defaultValue={rule?.input.renewLeadDays ?? DEFAULT_TIMING.renewLeadDays}
            description="So there is time to do it before it runs out." />
        </div>
      ) : null}
    </FormDialog>
  );
}

export function PauseRule({ id, title, paused }: { id: string; title: string; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" className="min-h-11" disabled={pending} aria-label={`${paused ? "Restart" : "Pause"} the rule for ${title}`}
      onClick={() => start(async () => {
        const result = await setTrainingRulePaused(id, !paused);
        if (!result.ok) { toast.error(result.error); return; }
        if (paused) announced(result.assigned); else toast.success("Rule paused. Nobody new is assigned until you restart it.");
        router.refresh();
      })}>
      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}<span className="pc-only-wide">{paused ? "Restart" : "Pause"}</span>
    </Button>
  );
}

export function RemoveRule({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmAction
      trigger={<Button type="button" variant="outline" className="min-h-11" aria-label={`Remove the rule for ${title}`}><Trash2 aria-hidden="true" /><span className="pc-only-wide">Remove</span></Button>}
      title={`Remove the rule for ${title}?`}
      description="Nobody new is assigned it automatically. Training it already assigned stays assigned, and the course stays in the matrix only while a rule needs it."
      confirmLabel="Remove rule"
      destructive
      successMessage="Rule removed"
      run={() => removeTrainingRule(id)}
    />
  );
}

export function RunRulesNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" className="min-h-11" disabled={pending}
      onClick={() => start(async () => {
        const result = await runTrainingRulesNow();
        if (!result.ok) { toast.error(result.error); return; }
        announced(result.assigned);
        router.refresh();
      })}>
      <RefreshCw aria-hidden="true" className={pending ? "animate-spin" : undefined} />{pending ? "Running…" : "Run all rules now"}
    </Button>
  );
}

