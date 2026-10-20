"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { minutesNow, today } from "@/lib/format";
import { submitReport } from "@/modules/incidents/features/report/server/actions";
import type { PersonInput, ReportInput } from "@/modules/incidents/shared/rules";
import { ageGroups, incidentCategories, incidentKinds, personTypes, type IncidentKind } from "@/modules/incidents/shared/types";

type Site = { id: string; name: string };
const blankPerson = (): PersonInput => ({ type: "public", ageGroup: "adult", name: "", userId: "", contact: "", injured: false, bodyPart: "", injury: "", firstAid: "", firstAidBy: "", ambulance: false, hospital: false });
const clock = () => { const m = minutesNow(); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

/** The report's checks, loaded with the form rather than with every incident page: the report
 *  pages share this feature's entry for Add to the report. */
const loadChecks = () => import("@/modules/incidents/shared/rules");

/** The two-minute report (docs/incidents.md): what kind, where and when, what
 *  happened, who was involved and who saw it. Only the first part is required;
 *  the centre or operations manager adds the rest at triage. Sending locks the reporter's words. */
export function ReportForm({ sites, areas, staff, docs }: { sites: Site[]; areas: Record<string, string[]>; staff: Record<string, Site[]>; docs: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadChecks().catch(() => undefined); }, []);
  const [f, setF] = useState<Omit<ReportInput, "people" | "witnesses">>({
    siteId: sites.length === 1 ? sites[0].id : "", area: "", kind: "" as IncidentKind, category: "" as ReportInput["category"],
    occurredOn: today(), occurredAt: clock(), description: "", immediateAction: "", raisedBy: "",
  });
  const [people, setPeople] = useState<PersonInput[]>([]);
  const [witnesses, setWitnesses] = useState<{ name: string; contact: string }[]>([]);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }));
  const setPerson = (i: number, change: Partial<PersonInput>) => setPeople((list) => list.map((p, j) => (j === i ? { ...p, ...change } : p)));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const input: ReportInput = { ...f, people, witnesses };
    const { reportProblem, reportSchema } = await loadChecks();
    const parsed = reportSchema.safeParse(input);
    const problem = parsed.success ? reportProblem(parsed.data) : parsed.error.issues[0].message;
    if (problem) { setError(problem); return; }
    start(async () => {
      const result = await submitReport(input);
      if (!result.ok) { setError(result.error); return; }
      toast.success("Report sent");
      router.push(`/incidents/${result.id}`);
    });
  }

  if (!sites.length) return <Notice tone="warning" title="Your role cannot report incidents at any site." description="Ask a Turnfin administrator to check the sites your role covers." />;

  return (
    <form onSubmit={send} className="flex flex-col gap-6" noValidate>
      <Notice title="Make it safe first" description="If anyone needs help, call 112 and follow the site's emergency action plan. Report here once everyone is safe. Worried about a child's welfare? That is a safeguarding concern, not an incident: tell the Designated Liaison Person straight away."
        actions={docs ? <Button asChild variant="outline" className="min-h-11"><a href={`/docs/library?type=EAP${f.siteId ? `&facility=${encodeURIComponent(f.siteId)}` : ""}`} target="_blank" rel="noreferrer"><LifeBuoy aria-hidden="true" />Emergency plans<span className="sr-only"> (opens in a new tab)</span></a></Button> : undefined} />

      <section aria-labelledby="inc-what" className="pc-panel flex flex-col gap-5">
        <h2 id="inc-what">About it</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">What kind</legend>
          <RadioGroup value={f.kind} onValueChange={(v) => set("kind", v as IncidentKind)} className="gap-2">
            {(Object.keys(incidentKinds) as IncidentKind[]).map((k) => (
              <ChoiceRow key={k} type="radio" id={`inc-kind-${k}`} value={k} title={incidentKinds[k].label} hint={incidentKinds[k].help} />
            ))}
          </RadioGroup>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What it was about" htmlFor="inc-category">
            <NativeSelect id="inc-category" value={f.category} onChange={(e) => set("category", e.target.value as ReportInput["category"])} required>
              <NativeSelectOption value="" disabled>Choose one</NativeSelectOption>
              {Object.entries(incidentCategories).map(([k, c]) => <NativeSelectOption key={k} value={k}>{c.label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          {sites.length > 1 ? (
            <Field label="Site" htmlFor="inc-site">
              <NativeSelect id="inc-site" value={f.siteId} onChange={(e) => set("siteId", e.target.value)} required>
                <NativeSelectOption value="" disabled>Choose a site</NativeSelectOption>
                {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Where at the site" htmlFor="inc-area" hint="Choose an area or type where" optional>
            <Input id="inc-area" list="inc-areas" value={f.area} onChange={(e) => set("area", e.target.value)} maxLength={120} placeholder="For example: Main pool, deep end" />
          </Field>
          <datalist id="inc-areas">{(areas[f.siteId] ?? []).map((a) => <option key={a} value={a} />)}</datalist>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Day" htmlFor="inc-day"><Input id="inc-day" type="date" value={f.occurredOn} max={today()} onChange={(e) => set("occurredOn", e.target.value)} required /></Field>
            <Field label="Time" htmlFor="inc-time"><Input id="inc-time" type="time" value={f.occurredAt} onChange={(e) => set("occurredAt", e.target.value)} required /></Field>
          </div>
        </div>
        <Field label="Who told you about it" htmlFor="inc-raised" hint="Their name and role, such as 'Aoife, lifeguard'. Leave it empty if you saw it yourself." optional>
          <Input id="inc-raised" value={f.raisedBy} onChange={(e) => set("raisedBy", e.target.value)} maxLength={200} />
        </Field>
        <Field label="What happened" htmlFor="inc-description" hint="Write what was seen, such as 'The child slipped on the step by the slide', rather than why you think it happened.">
          <Textarea id="inc-description" value={f.description} onChange={(e) => set("description", e.target.value)} rows={5} required minLength={10} maxLength={4000} />
        </Field>
        <Field label="What was done straight away" htmlFor="inc-action" hint="First aid, the area made safe, the pool cleared or closed." optional>
          <Textarea id="inc-action" value={f.immediateAction} onChange={(e) => set("immediateAction", e.target.value)} rows={3} maxLength={2000} />
        </Field>
      </section>

      <section aria-labelledby="inc-people" className="pc-panel flex flex-col gap-4">
        <div className="space-y-1">
          <h2 id="inc-people">People involved</h2>
          <p className="text-sm text-ui-muted-foreground">Anyone hurt, or at the centre of it. A near miss needs nobody named. Injury details are seen only by the people who triage reports.</p>
        </div>
        {people.map((p, i) => (
          <fieldset key={i} className="flex flex-col gap-4 rounded-card border border-ui-border p-4">
            <legend className="px-1 text-sm font-semibold">Person {i + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who they are" htmlFor={`inc-p${i}-type`}>
                <NativeSelect id={`inc-p${i}-type`} value={p.type} onChange={(e) => setPerson(i, { type: e.target.value as PersonInput["type"], userId: "" })}>
                  {Object.entries(personTypes).map(([k, label]) => <NativeSelectOption key={k} value={k}>{label}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="Age" htmlFor={`inc-p${i}-age`}>
                <NativeSelect id={`inc-p${i}-age`} value={p.ageGroup} onChange={(e) => setPerson(i, { ageGroup: e.target.value as PersonInput["ageGroup"] })}>
                  {Object.entries(ageGroups).map(([k, label]) => <NativeSelectOption key={k} value={k}>{label}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              {p.type === "staff" && (staff[f.siteId] ?? []).length ? (
                <Field label="Which staff member" htmlFor={`inc-p${i}-staff`} hint="Their injury goes on their HR file. Choose Not listed to type a name.">
                  <NativeSelect id={`inc-p${i}-staff`} value={p.userId} onChange={(e) => setPerson(i, { userId: e.target.value, name: staff[f.siteId].find((s) => s.id === e.target.value)?.name ?? "" })}>
                    <NativeSelectOption value="">Not listed</NativeSelectOption>
                    {staff[f.siteId].map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              ) : null}
              {p.type !== "staff" || !p.userId ? (
                <Field label="Name" htmlFor={`inc-p${i}-name`} optional><Input id={`inc-p${i}-name`} value={p.name} onChange={(e) => setPerson(i, { name: e.target.value })} maxLength={200} autoComplete="off" /></Field>
              ) : null}
              <Field label="Phone or email" htmlFor={`inc-p${i}-contact`} hint="For a child, their parent or guardian's" optional><Input id={`inc-p${i}-contact`} value={p.contact} onChange={(e) => setPerson(i, { contact: e.target.value })} maxLength={200} autoComplete="off" /></Field>
            </div>
            <ChoiceRow type="checkbox" id={`inc-p${i}-injured`} title="They were hurt or became ill" checked={p.injured} onCheckedChange={(on) => setPerson(i, { injured: on === true })} />
            {p.injured ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Part of the body" htmlFor={`inc-p${i}-part`} optional><Input id={`inc-p${i}-part`} value={p.bodyPart} onChange={(e) => setPerson(i, { bodyPart: e.target.value })} maxLength={200} placeholder="For example: left knee" /></Field>
                <Field label="Injury or illness" htmlFor={`inc-p${i}-injury`} optional><Input id={`inc-p${i}-injury`} value={p.injury} onChange={(e) => setPerson(i, { injury: e.target.value })} maxLength={500} placeholder="For example: graze, bump to the head" /></Field>
                <Field label="First aid given" htmlFor={`inc-p${i}-aid`} optional><Input id={`inc-p${i}-aid`} value={p.firstAid} onChange={(e) => setPerson(i, { firstAid: e.target.value })} maxLength={1000} /></Field>
                <Field label="Given by" htmlFor={`inc-p${i}-aidby`} optional><Input id={`inc-p${i}-aidby`} value={p.firstAidBy} onChange={(e) => setPerson(i, { firstAidBy: e.target.value })} maxLength={200} /></Field>
                <ChoiceRow type="checkbox" id={`inc-p${i}-ambulance`} title="An ambulance was called" checked={p.ambulance} onCheckedChange={(on) => setPerson(i, { ambulance: on === true })} />
                <ChoiceRow type="checkbox" id={`inc-p${i}-hospital`} title="They went to hospital or a doctor" checked={p.hospital} onCheckedChange={(on) => setPerson(i, { hospital: on === true })} />
              </div>
            ) : null}
            <div><Button type="button" variant="ghost" className="min-h-11" onClick={() => setPeople((list) => list.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" />Remove person {i + 1}</Button></div>
          </fieldset>
        ))}
        {people.length < 10 ? <div><Button type="button" variant="outline" className="min-h-11" onClick={() => setPeople((list) => [...list, blankPerson()])}><Plus aria-hidden="true" />Add a person</Button></div> : null}
      </section>

      <section aria-labelledby="inc-witnesses" className="pc-panel flex flex-col gap-4">
        <div className="space-y-1">
          <h2 id="inc-witnesses">Witnesses</h2>
          <p className="text-sm text-ui-muted-foreground">Who saw it, and how to reach them if a statement is needed.</p>
        </div>
        {witnesses.map((w, i) => (
          <div key={i} className="grid items-end gap-4 sm:grid-cols-two-fields-action">
            <Field label={`Witness ${i + 1}`} htmlFor={`inc-w${i}-name`}><Input id={`inc-w${i}-name`} value={w.name} onChange={(e) => setWitnesses((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={200} autoComplete="off" /></Field>
            <Field label="Phone or email" htmlFor={`inc-w${i}-contact`} optional><Input id={`inc-w${i}-contact`} value={w.contact} onChange={(e) => setWitnesses((l) => l.map((x, j) => (j === i ? { ...x, contact: e.target.value } : x)))} maxLength={200} autoComplete="off" /></Field>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setWitnesses((l) => l.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /><span className="sr-only">Remove witness {i + 1}</span></Button>
          </div>
        ))}
        {witnesses.length < 10 ? <div><Button type="button" variant="outline" className="min-h-11" onClick={() => setWitnesses((l) => [...l, { name: "", contact: "" }])}><Plus aria-hidden="true" />Add a witness</Button></div> : null}
      </section>

      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="min-h-11" disabled={pending}><Send aria-hidden="true" />{pending ? "Sending" : "Send report"}</Button>
        <p className="text-sm text-ui-muted-foreground">Once sent, your words are kept as written. You can add to them later.</p>
      </div>
    </form>
  );
}
