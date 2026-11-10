"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { createAssessment, editAssessment } from "@/modules/risk/features/assessments/server/actions";
import type { DetailsFormData } from "@/modules/risk/features/assessments/server/data";
import { riskBand } from "@/modules/risk/shared/rules";
import { REVIEW_MONTHS, reviewEvery, RISK_BAND_META, SUBJECT_HINT, SUBJECT_LABEL, SUBJECT_TYPES, type RiskAssessmentView, type SubjectType } from "@/modules/risk/shared/types";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** An assessment's details: where, what it is about, who owns it and how often it is reviewed.
 *  A new one starts as a draft and opens on its own page, where its hazards are added; changing
 *  one that was signed off sends it back for sign-off, and the form says so first. */
export function DetailsForm({ data, assessment }: { data: DetailsFormData; assessment?: RiskAssessmentView }) {
  const router = useRouter();
  const [pending, begin] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ids = useRef({ id: crypto.randomUUID(), operationId: crypto.randomUUID() });
  const a = assessment;
  const [f, setF] = useState({
    siteId: a?.siteId ?? data.start, subjectType: (a?.subjectType ?? "area") as SubjectType, subject: a?.subject ?? "", scope: a?.scope ?? "",
    departmentId: a?.departmentId ?? "", ownerId: a?.ownerId ?? "", assessorName: a?.assessorName ?? "", assessedOn: a?.assessedOn ?? data.today,
    reviewMonths: a?.reviewMonths ?? 12, targetScore: String(a?.targetScore ?? 8),
  });
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }));

  if (!data.sites.length) return <Notice tone="warning" title="Your role cannot write risk assessments at any site." description="Ask a Turnfin administrator to check the sites your role covers." />;
  const choices = data.choices[f.siteId] ?? { areas: [], departments: [], owners: [] };
  const names = f.subjectType === "area" ? choices.areas : data.jobs;
  /** What it already holds stays choosable, so changing an assessment never loses it. */
  const kept = a && a.subjectType === f.subjectType && a.subject && !names.some((n) => same(n, a.subject)) ? a.subject : null;
  const keptDepartment = a?.departmentId && !choices.departments.some((d) => d.id === a.departmentId) ? { id: a.departmentId, name: a.departmentName || "No longer on the list" } : null;
  const keptOwner = a?.ownerId && !choices.owners.some((p) => p.id === a.ownerId) ? { id: a.ownerId, name: a.ownerName } : null;
  const target = Number(f.targetScore);
  const back = a ? `/risk-assessments/${a.id}` : "/risk-assessments";
  const signed = a && (a.status === "approved" || a.ownerApprovedAt);

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (!f.siteId) return setError("Choose a site.");
    if (f.subject.trim().length < 2) return setError("Choose what the assessment is about.");
    if (!Number.isInteger(target) || target < 1 || target > 25) return setError("Give the target risk, from 1 to 25.");
    const fields = { subjectType: f.subjectType, subject: f.subject, scope: f.scope, departmentId: f.departmentId, ownerId: f.ownerId, assessorName: f.assessorName, assessedOn: f.assessedOn, reviewMonths: f.reviewMonths, targetScore: target };
    begin(async () => {
      const result = a
        ? await editAssessment({ id: a.id, operationId: ids.current.operationId, version: a.version, ...fields })
        : await createAssessment({ ...ids.current, siteId: f.siteId, ...fields });
      if (!result.ok) { setError(result.error); return; }
      toast.success(a ? "Details changed" : "Draft started. Add its hazards next.");
      router.push(`/risk-assessments/${result.id}`);
    });
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-(--space-7)" noValidate>
      {signed ? <Notice tone="warning" title="Changing this assessment clears its sign-off" description="It goes back to waiting for sign-off until its owner signs the changed assessment." /> : null}
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-(--space-7)">
        <legend className="sr-only">The assessment</legend>
        <section aria-labelledby="risk-about" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="risk-about">What it is about</h2></div>
          <div className="rec-card">
            {!a && data.sites.length > 1 ? (
              <Field label="Site" htmlFor="risk-site">
                <NativeSelect id="risk-site" value={f.siteId} onChange={(e) => setF((x) => ({ ...x, siteId: e.target.value, subject: x.subjectType === "area" ? "" : x.subject, departmentId: "", ownerId: "" }))} required className="min-h-11 w-full">
                  <NativeSelectOption value="" disabled>Choose a site</NativeSelectOption>
                  {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            ) : null}
            <div className="space-y-2">
              <p id="risk-type" className="text-sm font-semibold">It assesses</p>
              <SegmentedChoice aria-labelledby="risk-type" aria-describedby="risk-type-hint" fill="phone" value={f.subjectType}
                onValueChange={(v) => setF((x) => ({ ...x, subjectType: v as SubjectType, subject: a && a.subjectType === v ? a.subject : "" }))}
                options={SUBJECT_TYPES.map((t) => ({ value: t, label: SUBJECT_LABEL[t] }))} />
              <p id="risk-type-hint" className="text-sm text-ui-muted-foreground">{SUBJECT_HINT[f.subjectType]}</p>
            </div>
            {f.subjectType === "activity" ? (
              <Field label="Activity" htmlFor="risk-subject" hint="One assessment covers one activity at a site">
                <Input id="risk-subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} maxLength={160} required placeholder="For example: Handling pool chemicals" />
              </Field>
            ) : (
              <Field label={SUBJECT_LABEL[f.subjectType]} htmlFor="risk-subject" hint={f.subjectType === "area" ? "From the site’s areas, kept in Admin" : "From the positions kept in Admin"}>
                <NativeSelect id="risk-subject" value={f.subject} onChange={(e) => set("subject", e.target.value)} required className="min-h-11 w-full">
                  <NativeSelectOption value="" disabled>{names.length || kept ? `Choose ${f.subjectType === "area" ? "an area" : "a job"}` : f.subjectType === "area" ? "No areas listed for this site" : "No positions listed"}</NativeSelectOption>
                  {names.map((n) => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
                  {kept ? <NativeSelectOption value={kept}>{kept} (not on the list)</NativeSelectOption> : null}
                </NativeSelect>
              </Field>
            )}
            <Field label="What it covers" htmlFor="risk-scope" hint="The work, people and places this assessment takes in" optional>
              <Textarea id="risk-scope" value={f.scope} onChange={(e) => set("scope", e.target.value)} rows={3} maxLength={4000} />
            </Field>
          </div>
        </section>

        <section aria-labelledby="risk-who" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="risk-who">Who answers for it</h2></div>
          <div className="rec-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" htmlFor="risk-owner" hint="Signs it off. Needed before it is sent for sign-off" optional>
                <NativeSelect id="risk-owner" value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)} className="min-h-11 w-full">
                  <NativeSelectOption value="">Not chosen yet</NativeSelectOption>
                  {choices.owners.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.jobTitle ? `${p.name}, ${p.jobTitle}` : p.name}</NativeSelectOption>)}
                  {keptOwner ? <NativeSelectOption value={keptOwner.id}>{keptOwner.name} (cannot sign off here)</NativeSelectOption> : null}
                </NativeSelect>
              </Field>
              <Field label="Department" htmlFor="risk-department" optional>
                <NativeSelect id="risk-department" value={f.departmentId} onChange={(e) => set("departmentId", e.target.value)} className="min-h-11 w-full">
                  <NativeSelectOption value="">No department</NativeSelectOption>
                  {choices.departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
                  {keptDepartment ? <NativeSelectOption value={keptDepartment.id}>{keptDepartment.name}</NativeSelectOption> : null}
                </NativeSelect>
              </Field>
              <Field label="Assessed by" htmlFor="risk-assessor" hint="Whoever carried it out, if not the owner" optional>
                <Input id="risk-assessor" value={f.assessorName} onChange={(e) => set("assessorName", e.target.value)} maxLength={120} autoComplete="off" />
              </Field>
              <Field label="Assessed on" htmlFor="risk-assessed">
                <Input id="risk-assessed" type="date" value={f.assessedOn} max={data.today} onChange={(e) => set("assessedOn", e.target.value)} required />
              </Field>
            </div>
          </div>
        </section>

        <section aria-labelledby="risk-review" className="flex min-w-0 flex-col">
          <div className="pc-section-head"><h2 id="risk-review">Review and target</h2></div>
          <div className="rec-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reviewed" htmlFor="risk-months" hint="Counted from the last review, or from the assessment day">
                <NativeSelect id="risk-months" value={String(f.reviewMonths)} onChange={(e) => set("reviewMonths", Number(e.target.value))} className="min-h-11 w-full">
                  {[...new Set([...REVIEW_MONTHS, f.reviewMonths])].sort((x, y) => x - y).map((m) => <NativeSelectOption key={m} value={String(m)}>{reviewEvery(m)}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="Target risk" htmlFor="risk-target" hint={Number.isInteger(target) && target >= 1 && target <= 25 ? `${RISK_BAND_META[riskBand(target)].label}. The score, 1 to 25, the hazards should come down to` : "The score, 1 to 25, the hazards should come down to"}>
                <Input id="risk-target" type="number" inputMode="numeric" min={1} max={25} step={1} value={f.targetScore} onChange={(e) => set("targetScore", e.target.value)} required />
              </Field>
            </div>
          </div>
        </section>
      </fieldset>

      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <LoadingButton type="submit" className="min-h-11" pending={pending} pendingLabel="Saving…"><Save aria-hidden="true" />{a ? "Save changes" : "Start the draft"}</LoadingButton>
        <Button asChild variant="outline" className="min-h-11"><Link href={back}>Cancel</Link></Button>
      </div>
    </form>
  );
}
