"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { SearchField } from "@/components/ui-kit/search-field";
import { formatDate } from "@/lib/format";
import type { MemberHit } from "@/modules/contributions";
import { findSwimmers } from "@/modules/short-courses/shared/swimmer-search";

/** "Find the swimmer" (owner request, 21 October 2026): the first step of booking someone on a
 *  short course or an Academy course. The desk searches the swimmer records by name, member
 *  number, date of birth or a parent's name and picks the person, or adds them as a new swimmer
 *  when they are not there. It posts `swimmerId`, or `swimmerMode=new` with the new swimmer's
 *  fields (`sw-…`); `readSwimmerChoice` reads them back. */

export type PickedSwimmer = Pick<MemberHit, "id" | "memberNumber" | "firstName" | "lastName" | "dateOfBirth" | "contactName">;
/** What a new swimmer starts with, e.g. from a place held online. */
export type SwimmerPrefill = { firstName?: string; lastName?: string; dateOfBirth?: string; contactEmail?: string; contactPhone?: string };

const NEW = "new";
const dob = (iso: string | null) => (iso ? `born ${formatDate(new Date(`${iso}T00:00:00Z`))}` : "no date of birth");
export const swimmerHint = (s: Pick<MemberHit, "memberNumber" | "dateOfBirth" | "contactName">) =>
  [s.memberNumber ? `Member ${s.memberNumber}` : "No member number", dob(s.dateOfBirth), s.contactName ? `contact ${s.contactName}` : null].filter(Boolean).join(" · ");

/** Splits "Aoife Ní Bhriain" into a first name and the rest, for a new swimmer's name. */
export function splitName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: words[0] ?? "", lastName: words.slice(1).join(" ") };
}

export function readSwimmerChoice(fd: FormData) {
  const v = (key: string) => String(fd.get(key) ?? "");
  if (v("swimmerMode") !== NEW) return { swimmerId: v("swimmerId"), newSwimmer: null };
  return {
    swimmerId: "",
    newSwimmer: {
      firstName: v("sw-firstName"), lastName: v("sw-lastName"), dateOfBirth: v("sw-dateOfBirth"), memberNumber: v("sw-memberNumber"),
      contactName: v("sw-contactName"), contactEmail: v("sw-contactEmail"), contactPhone: v("sw-contactPhone"),
      emergencyName: v("sw-emergencyName"), emergencyPhone: v("sw-emergencyPhone"), emergencyRelationship: v("sw-emergencyRelationship"), medicalNotes: v("sw-medicalNotes"),
    },
  };
}

export function SwimmerPicker({ fid, label = "Find the swimmer", initialQuery = "", prefill, picked: start, needsDateOfBirth, onPick }: {
  fid: string; label?: string; initialQuery?: string; prefill?: SwimmerPrefill; picked?: PickedSwimmer | null;
  /** Who is picked now: someone on the records, "new", or nobody yet. */
  onPick?: (picked: PickedSwimmer | "new" | null) => void;
  /** The course has a minimum age, so a new swimmer needs their date of birth. */
  needsDateOfBirth?: boolean;
}) {
  const [q, setQ] = useState(initialQuery);
  // The last answer, kept with the words it answers, so an older answer never shows for newer typing.
  const [result, setResult] = useState<{ term: string; hits: MemberHit[] }>({ term: "", hits: [] });
  const term = q.trim();
  const searched = term.length >= 2 && result.term === term;
  const hits = searched ? result.hits : [];
  const [choice, setChoice] = useState("");
  const [picked, setPicked] = useState<PickedSwimmer | null>(start ?? null);
  const [pending, startTransition] = useTransition();
  const pick = (next: PickedSwimmer | null) => { setPicked(next); onPick?.(next); };
  const choose = (next: string) => { setChoice(next); onPick?.(next === NEW ? "new" : null); };

  useEffect(() => {
    if (picked || term.length < 2) return;
    const timer = setTimeout(() => startTransition(async () => {
      const found = await findSwimmers(term).catch(() => []);
      setResult({ term, hits: found });
    }), 250);
    return () => clearTimeout(timer);
  }, [term, picked]);

  if (picked) {
    return (
      <div className="flex flex-col gap-2">
        <input type="hidden" name="swimmerId" value={picked.id} />
        <p className="text-sm font-semibold">Swimmer record</p>
        <div className="pc-row rounded-2xl bg-ui-muted px-4">
          <span className="pc-row-body">
            <span className="pc-row-title">{picked.firstName} {picked.lastName}</span>
            <span className="pc-row-hint">{swimmerHint(picked)}</span>
          </span>
          <span className="pc-row-trail">
            <Button type="button" variant="ghost" onClick={() => { pick(null); setChoice(""); setQ(`${picked.firstName} ${picked.lastName}`); }}>Change</Button>
          </span>
        </div>
      </div>
    );
  }

  const name = prefill?.firstName || prefill?.lastName ? { firstName: prefill.firstName ?? "", lastName: prefill.lastName ?? "" } : splitName(/\d/.test(q) ? "" : q);
  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="swimmerMode" value={choice === NEW ? NEW : ""} />
      <input type="hidden" name="swimmerId" value={choice && choice !== NEW ? choice : ""} />
      {/* Enter searches as you type; it must not send the booking. */}
      <div onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
        <SearchField id={`${fid}-find`} label={label} placeholder="Name, member number, date of birth or parent" maxLength={80} value={q} onValueChange={(v) => { setQ(v); if (choice && choice !== NEW) choose(""); }} />
      </div>
      <p className="pc-row-hint" aria-live="polite">
        {pending || (term.length >= 2 && !searched) ? "Searching…" : term.length < 2 ? "Type at least two letters, or add them as a new swimmer." : searched && hits.length === 0 ? "Nobody on the swimmer records matches. Check the spelling, or add them as a new swimmer." : searched ? `${hits.length === 20 ? "The first 20" : hits.length} on the swimmer records. Pick the right person.` : ""}
      </p>
      <RadioGroup value={choice} onValueChange={(v) => {
        const hit = hits.find((h) => h.id === v);
        if (hit) pick(hit); else choose(v);
      }} aria-label="Who is it?" className="gap-2">
        {hits.map((h) => (
          <ChoiceRow key={h.id} type="radio" id={`${fid}-hit-${h.id}`} value={h.id} title={`${h.firstName} ${h.lastName}${h.active ? "" : " (inactive)"}`} hint={swimmerHint(h)} />
        ))}
        <ChoiceRow type="radio" id={`${fid}-new`} value={NEW} title="Add them as a new swimmer" hint="Not on the swimmer records yet. They are added there and booked on." />
      </RadioGroup>
      {choice === NEW ? (
        <fieldset className="flex flex-col gap-4 rounded-2xl bg-ui-muted p-4">
          <legend className="sr-only">New swimmer</legend>
          <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus aria-hidden="true" className="size-4" />New swimmer record</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor={`${fid}-sw-first`}><Input id={`${fid}-sw-first`} name="sw-firstName" required maxLength={60} defaultValue={name.firstName} className="min-h-11" /></Field>
            <Field label="Last name" htmlFor={`${fid}-sw-last`}><Input id={`${fid}-sw-last`} name="sw-lastName" required maxLength={60} defaultValue={name.lastName} className="min-h-11" /></Field>
            <Field label="Date of birth" htmlFor={`${fid}-sw-dob`} optional={!needsDateOfBirth}><Input id={`${fid}-sw-dob`} name="sw-dateOfBirth" type="date" required={needsDateOfBirth} defaultValue={prefill?.dateOfBirth ?? ""} className="min-h-11" /></Field>
            <Field label="Member number" htmlFor={`${fid}-sw-member`} optional hint="From the till system, when they have one."><Input id={`${fid}-sw-member`} name="sw-memberNumber" maxLength={40} className="min-h-11" /></Field>
            <Field label="Contact" htmlFor={`${fid}-sw-contact`} optional hint="A parent, or themselves for an adult."><Input id={`${fid}-sw-contact`} name="sw-contactName" maxLength={120} className="min-h-11" /></Field>
            <Field label="Phone" htmlFor={`${fid}-sw-phone`}><Input id={`${fid}-sw-phone`} name="sw-contactPhone" type="tel" required maxLength={40} defaultValue={prefill?.contactPhone ?? ""} className="min-h-11" /></Field>
            <Field label="Email" htmlFor={`${fid}-sw-email`} optional><Input id={`${fid}-sw-email`} name="sw-contactEmail" type="email" maxLength={200} defaultValue={prefill?.contactEmail ?? ""} className="min-h-11" /></Field>
            <Field label="Emergency contact" htmlFor={`${fid}-sw-emergency`} optional><Input id={`${fid}-sw-emergency`} name="sw-emergencyName" maxLength={120} className="min-h-11" /></Field>
            <Field label="Emergency phone" htmlFor={`${fid}-sw-emergency-phone`} optional><Input id={`${fid}-sw-emergency-phone`} name="sw-emergencyPhone" type="tel" maxLength={40} className="min-h-11" /></Field>
            <Field label="Relationship" htmlFor={`${fid}-sw-relationship`} optional><Input id={`${fid}-sw-relationship`} name="sw-emergencyRelationship" maxLength={60} placeholder="Mother" className="min-h-11" /></Field>
          </div>
          <Field label="Medical notes" htmlFor={`${fid}-sw-medical`} optional hint="Anything the instructor must know. Shown to the desk and the instructor, never in a list."><Textarea id={`${fid}-sw-medical`} name="sw-medicalNotes" maxLength={2000} /></Field>
        </fieldset>
      ) : null}
    </div>
  );
}
