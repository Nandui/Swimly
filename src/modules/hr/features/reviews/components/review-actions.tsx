"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Save, Send } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { REVIEW_OVERALL_LABELS, type ReviewOverall } from "@/modules/hr/shared/constants";
import { saveReview, shareReview } from "@/modules/hr/features/reviews/server/actions";
import { formatDateTime } from "@/lib/format";
import { THEME } from "@/modules/hr/shared/components/dialog-kit";

export function StartReview({ subjectUserId, name }: { subjectUserId: string; name: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><FilePlus2 aria-hidden="true" />Start a review</Button>}
      title={`Start a review for ${name}`}
      description="It stays a draft, seen only by you and superadmins, until you share it with them."
      submitLabel="Start draft"
      successMessage="Draft started"
      submit={(formData) => saveReview(null, subjectUserId, { period: String(formData.get("period") ?? ""), summary: "", strengths: "", goals: "", overall: "" })}
    >
      <Field label="Review period" htmlFor="hr-review-period" hint="For example: 2026 annual review, or Probation (3 months).">
        <Input id="hr-review-period" name="period" required minLength={2} maxLength={80} className="min-h-11" />
      </Field>
    </FormDialog>
  );
}

type Draft = { id: string; subjectUserId: string; period: string; summary: string; strengths: string; goals: string; overall: ReviewOverall | null; createdAt: Date; updatedAt: Date };

/** The reviewer's editor for a draft. Saving keeps it private; sharing locks
 *  it and shows it to the person. */
export function ReviewEditor({ review, name, isReviewer }: { review: Draft; name: string; isReviewer: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function save(form: HTMLFormElement) {
    const data = new FormData(form);
    setError(null);
    start(async () => {
      const result = await saveReview(review.id, review.subjectUserId, {
        period: String(data.get("period") ?? ""), summary: String(data.get("summary") ?? ""),
        strengths: String(data.get("strengths") ?? ""), goals: String(data.get("goals") ?? ""), overall: String(data.get("overall") ?? "") as ReviewOverall | "",
      });
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }
  return (
    // The form wraps both panels, so Save draft in the footer still submits the fields.
    <form method="post" className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); save(event.currentTarget); }}>
      <section className="pc-panel" aria-labelledby="review-editor">
        <div className="pc-panel-head"><h2 id="review-editor">Draft</h2></div>
        <div className="space-y-2"><Label htmlFor="rv-period" className="block">Review period</Label><Input id="rv-period" name="period" defaultValue={review.period} required minLength={2} maxLength={80} className="min-h-11" /></div>
        <div className="space-y-2"><Label htmlFor="rv-summary" className="block">Summary</Label><Textarea id="rv-summary" name="summary" defaultValue={review.summary} rows={5} maxLength={5000} /></div>
        <div className="space-y-2"><Label htmlFor="rv-strengths" className="block">Strengths</Label><Textarea id="rv-strengths" name="strengths" defaultValue={review.strengths} rows={4} maxLength={5000} /></div>
        <div className="space-y-2"><Label htmlFor="rv-goals" className="block">Goals for the next period</Label><Textarea id="rv-goals" name="goals" defaultValue={review.goals} rows={4} maxLength={5000} /></div>
        <Field label="Overall" htmlFor="rv-overall" optional>
          <NativeSelect id="rv-overall" name="overall" defaultValue={review.overall ?? ""} className="min-h-11 w-full">
            <NativeSelectOption value="">Not stated</NativeSelectOption>
            {Object.entries(REVIEW_OVERALL_LABELS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </section>
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div className="pc-panel">
        <div className="pc-panel-head">
          <p role="status" className="text-sm font-semibold">
            {pending ? "Saving…" : `Draft saved ${formatDateTime(new Date(review.updatedAt))}`}
            <span className="font-normal text-ui-muted-foreground">
              {isReviewer ? " · only you and superadmins can see it" : " · only the reviewer and superadmins can see it"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" className="min-h-11" disabled={pending}><Save aria-hidden="true" />Save draft</Button>
            <ShareReview id={review.id} name={name} />
          </div>
        </div>
      </div>
    </form>
  );
}

function ShareReview({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button type="button" className="min-h-11"><Send aria-hidden="true" />Share with {name.split(" ")[0]}</Button>}
      title={`Share this review with ${name}?`}
      description="Save your latest changes first. Once shared it cannot be edited; they see it in Turnfin Me and can add a comment when they acknowledge it."
      confirmLabel="Share review"
      successMessage="Review shared"
      run={() => shareReview(id)}
    />
  );
}
