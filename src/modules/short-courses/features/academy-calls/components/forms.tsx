"use client";

import { useState, type ReactNode } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Field, FormDialog } from "@/components/form-dialog";
import { logCall } from "@/modules/short-courses/features/academy-calls/server/actions";
import { ACADEMY_CALL_META, ACADEMY_CALL_OUTCOMES, ACADEMY_CALL_TIMES, euro } from "@/modules/short-courses/shared/academy-rules";

import { amount, text, THEME, useRefresh } from "@/modules/short-courses/shared/components/form-kit";
import { readSwimmerChoice, splitName, SwimmerPicker } from "@/modules/short-courses/shared/components/swimmer-picker";

/** Phoning people who held a place online (docs/academy.md). */

/* ---------- Phoning people who held a place online ---------- */

export type CallPerson = {
  id: string; name: string; phone: string; phone2: string; callTimes: string[]; reference: string | null; heldAt: string;
  /** Linked to a swimmer record already (or one of our staff), so taking payment does not ask. */
  linked?: boolean; email?: string; dateOfBirth?: string | null;
  calls: { outcome: string; byName: string; at: string; note: string }[];
};

const CALL_HINT: Record<string, string> = {
  paid: "Record what was taken. The full price confirms the place; less is a deposit.",
  "no-answer": "They stay on the list to call.",
  "call-back": "They stay on the list. Say when in the note.",
  "not-going-ahead": "They are withdrawn and the place is free again.",
};

/** Log a call (owner decision, 8 October 2026): what happened, kept with who called and when, so
 *  whoever picks up the list next sees what has been tried. */
export function CallDialog({ person, course, priceCents, primary, swimmerRecords = false }: { person: CallPerson; course: string; priceCents: number; primary?: boolean; swimmerRecords?: boolean }) {
  const refresh = useRefresh();
  const [outcome, setOutcome] = useState("");
  const fid = `call-${person.id}`;
  // Paid confirms the place, so someone not on the swimmer records yet is found or added there.
  const matching = outcome === "paid" && swimmerRecords && !person.linked;
  const facts: [string, ReactNode][] = [
    ["Mobile", <a key="p" href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className="font-semibold tabular-nums">{person.phone}</a>],
    ...(person.phone2 ? [["Other number", <a key="p2" href={`tel:${person.phone2.replace(/[^\d+]/g, "")}`} className="font-semibold tabular-nums">{person.phone2}</a>] as [string, ReactNode]] : []),
    ["Best time", person.callTimes.length ? person.callTimes.map((t) => ACADEMY_CALL_TIMES[t as keyof typeof ACADEMY_CALL_TIMES] ?? t).join(", ") : "Any time"],
    ["Held online", `${person.heldAt}${person.reference ? ` · ${person.reference}` : ""}`],
    ["Earlier calls", person.calls.length ? person.calls.map((c) => `${c.at} ${(ACADEMY_CALL_META[c.outcome as keyof typeof ACADEMY_CALL_META]?.label ?? c.outcome).toLowerCase()} (${c.byName})`).join(" · ") : "None yet"],
  ];
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={<Button variant={primary ? "default" : "outline"}><Phone aria-hidden="true" />Log a call</Button>}
      title={`Log a call: ${person.name}`} description={`${course} · ${priceCents ? `${euro(priceCents)} to pay` : "no charge"}`}
      submitLabel="Save call" successMessage="Call saved" onSuccess={() => { setOutcome(""); refresh(); }}
      submit={(fd) => logCall(person.id, { outcome: text(fd, "outcome"), amount: text(fd, "amount"), receipt: text(fd, "receipt"), note: text(fd, "note"),
        swimmer: matching ? readSwimmerChoice(fd) : undefined })}>
      <dl className="flex flex-col rounded-2xl bg-ui-muted px-4 py-1 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 py-1"><dt className="text-ui-muted-foreground">{label}</dt><dd className="text-right wrap-anywhere">{value}</dd></div>
        ))}
      </dl>
      <RadioGroup name="outcome" value={outcome} onValueChange={setOutcome} className="gap-2" aria-label="How did it go?" required>
        {ACADEMY_CALL_OUTCOMES.map((o) => <ChoiceRow key={o} type="radio" id={`${fid}-${o}`} value={o} title={ACADEMY_CALL_META[o].label} hint={CALL_HINT[o]} />)}
      </RadioGroup>
      {outcome === "paid" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount taken (€)" htmlFor={`${fid}-amount`}><Input id={`${fid}-amount`} name="amount" inputMode="decimal" required defaultValue={priceCents ? amount(priceCents) : "0"} className="min-h-11" /></Field>
          <Field label="Till receipt" htmlFor={`${fid}-receipt`} optional><Input id={`${fid}-receipt`} name="receipt" maxLength={60} className="min-h-11" /></Field>
        </div>
      ) : null}
      {matching ? <SwimmerPicker fid={fid} label="Find them on the swimmer records" initialQuery={person.name}
        prefill={{ ...splitName(person.name), contactPhone: person.phone, contactEmail: person.email, dateOfBirth: person.dateOfBirth ?? undefined }} /> : null}
      <Field label="Note" htmlFor={`${fid}-note`} optional><Input id={`${fid}-note`} name="note" maxLength={300} placeholder={outcome === "call-back" ? "After 17:00 today" : undefined} className="min-h-11" /></Field>
    </FormDialog>
  );
}
