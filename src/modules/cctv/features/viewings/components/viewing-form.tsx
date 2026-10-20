"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { minutesNow } from "@/lib/format";
import { recordViewing } from "@/modules/cctv/features/viewings/server/actions";
import { CCTV_REASON_META, CCTV_REASONS, viewingProblem, viewingSchema, type ViewingInput } from "@/modules/cctv/shared/rules";

type Site = { id: string; name: string };
const clock = () => { const m = minutesNow(); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

/** Record a viewing (docs/cctv.md), in the order people think about it: where and when, why,
 *  what they looked at, what they saw. Saving locks it; later facts are added as notes. */
export function ViewingForm({ sites, today, me }: { sites: Site[]; today: string; me: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Required<ViewingInput>>({
    siteId: sites.length === 1 ? sites[0].id : "", viewedOn: today, viewedAt: clock(), checkedBy: me, othersPresent: "",
    reason: "" as ViewingInput["reason"], background: "", purpose: "", cameras: "", footageOn: today, footageFrom: "", footageTo: "",
    findings: "", copies: "", incident: "",
  });
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }));

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = viewingSchema.safeParse(f);
    const problem = parsed.success ? viewingProblem(parsed.data, today) : parsed.error.issues[0].message;
    if (problem) { setError(problem); return; }
    setError(null);
    start(async () => {
      const result = await recordViewing(f);
      if (!result.ok) { setError(result.error); return; }
      toast.success("Viewing recorded");
      router.push(`/cctv/${result.id}`);
    });
  }

  if (!sites.length) return <Notice tone="warning" title="Your role cannot record CCTV viewings at any site." description="Ask a Turnfin administrator to check the sites your role covers." />;

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <section aria-labelledby="cctv-who" className="pc-panel flex flex-col gap-5">
        <h2 id="cctv-who">Who checked it, and when</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.length > 1 ? (
            <Field label="Site" htmlFor="cctv-site">
              <NativeSelect id="cctv-site" value={f.siteId} onChange={(e) => set("siteId", e.target.value)} required className="min-h-11 w-full">
                <NativeSelectOption value="" disabled>Choose a site</NativeSelectOption>
                {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Day checked" htmlFor="cctv-day"><Input id="cctv-day" type="date" value={f.viewedOn} max={today} onChange={(e) => set("viewedOn", e.target.value)} required className="min-h-11" /></Field>
            <Field label="Time" htmlFor="cctv-time"><Input id="cctv-time" type="time" value={f.viewedAt} onChange={(e) => set("viewedAt", e.target.value)} required className="min-h-11" /></Field>
          </div>
          <Field label="Who checked the footage" htmlFor="cctv-by" hint="You, unless you are writing it up for someone else.">
            <Input id="cctv-by" value={f.checkedBy} onChange={(e) => set("checkedBy", e.target.value)} maxLength={200} required className="min-h-11" />
          </Field>
          <Field label="Anyone else watching" htmlFor="cctv-others" hint="Their name and who they are, such as 'Garda Ryan, Bishopstown station'." optional>
            <Input id="cctv-others" value={f.othersPresent} onChange={(e) => set("othersPresent", e.target.value)} maxLength={500} autoComplete="off" className="min-h-11" />
          </Field>
        </div>
      </section>

      <section aria-labelledby="cctv-why" className="pc-panel flex flex-col gap-5">
        <h2 id="cctv-why">Why it was checked</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reason" htmlFor="cctv-reason">
            <NativeSelect id="cctv-reason" value={f.reason} onChange={(e) => set("reason", e.target.value as ViewingInput["reason"])} required className="min-h-11 w-full">
              <NativeSelectOption value="" disabled>Choose one</NativeSelectOption>
              {CCTV_REASONS.map((r) => <NativeSelectOption key={r} value={r}>{CCTV_REASON_META[r].label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field label="Incident report" htmlFor="cctv-incident" hint="Its number, such as INC-00042, if there is one." optional>
            <Input id="cctv-incident" value={f.incident} onChange={(e) => set("incident", e.target.value)} maxLength={20} autoComplete="off" className="min-h-11" />
          </Field>
        </div>
        <Field label="What led to the check" htmlFor="cctv-background" hint="What happened, or who asked, in a sentence or two.">
          <Textarea id="cctv-background" value={f.background} onChange={(e) => set("background", e.target.value)} rows={3} required maxLength={4000} />
        </Field>
        <Field label="What you were looking for" htmlFor="cctv-purpose" hint="The question the footage should answer, such as 'whether the bag was taken from locker 14'.">
          <Textarea id="cctv-purpose" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} rows={2} required maxLength={2000} />
        </Field>
      </section>

      <section aria-labelledby="cctv-what" className="pc-panel flex flex-col gap-5">
        <h2 id="cctv-what">What was watched, and what was seen</h2>
        <Field label="Cameras" htmlFor="cctv-cameras" hint="Their names or numbers, such as 'Camera 3, changing village corridor'.">
          <Input id="cctv-cameras" value={f.cameras} onChange={(e) => set("cameras", e.target.value)} maxLength={500} required className="min-h-11" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Footage from the day" htmlFor="cctv-fday"><Input id="cctv-fday" type="date" value={f.footageOn} max={f.viewedOn || today} onChange={(e) => set("footageOn", e.target.value)} required className="min-h-11" /></Field>
          <Field label="From" htmlFor="cctv-from"><Input id="cctv-from" type="time" value={f.footageFrom} onChange={(e) => set("footageFrom", e.target.value)} required className="min-h-11" /></Field>
          <Field label="To" htmlFor="cctv-to"><Input id="cctv-to" type="time" value={f.footageTo} onChange={(e) => set("footageTo", e.target.value)} required className="min-h-11" /></Field>
        </div>
        <Field label="What you saw" htmlFor="cctv-findings" hint="Describe what the footage shows, not what you think it means. If nothing relevant was seen, say so.">
          <Textarea id="cctv-findings" value={f.findings} onChange={(e) => set("findings", e.target.value)} rows={5} required maxLength={6000} />
        </Field>
        <Field label="Copies saved or handed over" htmlFor="cctv-copies" hint="What was copied, to whom and how, such as 'two clips on a USB key, given to Garda Ryan'. Leave it empty if nothing was." optional>
          <Textarea id="cctv-copies" value={f.copies} onChange={(e) => set("copies", e.target.value)} rows={2} maxLength={1000} />
        </Field>
      </section>

      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="min-h-11" disabled={pending}><Save aria-hidden="true" />{pending ? "Saving" : "Save the record"}</Button>
        <p className="text-sm text-ui-muted-foreground">Once saved it can’t be changed or deleted. You can add to it later.</p>
      </div>
    </form>
  );
}
