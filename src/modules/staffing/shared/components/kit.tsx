"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/shadcn/input";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Tag } from "@/components/ui-kit/tag";
import type { ActionResult } from "@/lib/action-result";
import { formatShortDay, formatTimeRange } from "@/lib/format";
import { FIT_META, formatHours, rankFits, SLOT_ROLE_META, type Candidate, type Fit, type FitShift, type SlotRole, type StaffingSettings } from "@/modules/staffing/shared/rules";

/** What Staffing's screens share. Every dialog is a FormDialog, so a refusal keeps the typing and
 *  shows the sentence beside the fields. Warnings are worked out here from the same rules the
 *  server uses, so the picker shows them before anyone is chosen. */

export const THEME = "turnfin-module";
export const text = (fd: FormData, key: string) => String(fd.get(key) ?? "");
export const checked = (fd: FormData, key: string) => fd.get(key) === "on";

export function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

export function RoleTag({ role }: { role: string }) {
  return <Tag meta={SLOT_ROLE_META[(role in SLOT_ROLE_META ? role : "teaching") as SlotRole]} />;
}

export function Warnings({ warnings }: { warnings: readonly Fit[] }) {
  if (!warnings.length) return null;
  return <span className="flex flex-wrap gap-1">{warnings.map((w) => <span key={w.kind} title={w.text}><Tag meta={FIT_META[w.kind]} /></span>)}</span>;
}

export const shiftLabel = (s: { date: string; startMin: number; endMin: number; name: string }) =>
  `${s.name}, ${formatShortDay(new Date(`${s.date}T00:00:00Z`))} ${formatTimeRange(s.startMin, s.endMin)}`;

const TIER_HINT = ["Below contracted hours that week", "Wants extra hours, no strikes", "Wants extra hours", ""];

/** Choose a person for a shift, best fit first, each with their warnings. Nothing is refused:
 *  the warnings are shown and the chooser decides. */
export function PersonPicker({ shift, people, shifts, settings, trigger, title, description, submitLabel, successMessage, exclude = [], allowNobody = false, reason, act }: {
  shift: FitShift & { name: string };
  people: readonly Candidate[];
  shifts: readonly (FitShift & { userId: string })[];
  settings: StaffingSettings;
  trigger: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  successMessage: string;
  exclude?: readonly string[];
  allowNobody?: boolean;
  /** Ask why (a change to a published shift). */
  reason?: boolean;
  act: (userId: string | null, reason: string) => Promise<ActionResult>;
}) {
  const refresh = useRefresh();
  const ranked = useMemo(() => rankFits(shift, people.filter((p) => !exclude.includes(p.id)), shifts, settings), [shift, people, shifts, settings, exclude]);
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-xl" trigger={trigger} title={title} description={description ?? shiftLabel(shift)}
      submitLabel={submitLabel} successMessage={successMessage} onSuccess={refresh}
      submit={(fd) => {
        const id = text(fd, "userId");
        return act(id === "" || id === "nobody" ? null : id, text(fd, "reason"));
      }}>
      {reason ? (
        <Field label="Why is it changing?" htmlFor="stf-reason" hint="A published shift changes only with a reason, kept in the log.">
          <Input id="stf-reason" name="reason" required minLength={3} maxLength={300} className="min-h-11" />
        </Field>
      ) : null}
      {ranked.length === 0 && !allowNobody ? <p className="text-sm text-ui-muted-foreground">Nobody on the rota yet. Add people under Set up, Staff.</p> : (
        <RadioGroup name="userId" required aria-label="Who" className="pc-list max-h-96 overflow-y-auto">
          {allowNobody ? <ChoiceRow type="radio" value="nobody" title="Nobody" hint="Leave the place empty" /> : null}
          {ranked.map((p) => (
            <ChoiceRow key={p.id} type="radio" value={p.id} title={p.name}
              hint={<span className="flex flex-col gap-1">
                <span>{[TIER_HINT[p.tier], `${formatHours(p.week)} that week${p.contractMinutes !== null ? ` of ${formatHours(p.contractMinutes)} contracted` : ""}`, p.strikes ? `${p.strikes} strike${p.strikes === 1 ? "" : "s"} this semester` : null].filter(Boolean).join(" · ")}</span>
                <Warnings warnings={p.warnings} />
              </span>} />
          ))}
        </RadioGroup>
      )}
    </FormDialog>
  );
}
