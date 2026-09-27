"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FilePlus2, Save, Send, StickyNote, Undo2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { NOTE_VISIBILITY_META, NOTE_VISIBILITIES, REVIEW_OVERALL_LABELS, type ReviewOverall } from "@/lib/hr/constants";
import { acknowledgeReview, addNote, saveReview, shareReview, withdrawNote } from "@/lib/hr/actions";


export function AddNote({ subjectUserId, name }: { subjectUserId: string; name: string }) {
  const [visibility, setVisibility] = useState("record");
  return (
    <FormDialog
      width="sm:max-w-lg"
      trigger={<Button className="min-h-11"><StickyNote aria-hidden="true" />Add note</Button>}
      title={`Add a note for ${name}`}
      description="Keep to facts: what happened, when, and what was agreed. It is recorded against your name."
      submitLabel="Add note"
      successMessage="Note added"
      onOpen={() => setVisibility("record")}
      submit={(formData) => addNote(subjectUserId, String(formData.get("body") ?? ""), visibility)}
    >
      <Field label="Note" htmlFor="hr-note-body">
        <Textarea id="hr-note-body" name="body" rows={6} required minLength={3} maxLength={5000} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Who can read it</legend>
        <RadioGroup value={visibility} onValueChange={setVisibility} className="gap-1">
          {NOTE_VISIBILITIES.map((key) => (
            <div key={key} className="flex min-h-11 items-start gap-3 py-1">
              <RadioGroupItem id={`hr-vis-${key}`} value={key} className="mt-1" />
              <Label htmlFor={`hr-vis-${key}`} className="block font-normal">
                <span className="block font-medium">{NOTE_VISIBILITY_META[key].label}</span>
                <span className="block text-sm text-ui-muted-foreground">{NOTE_VISIBILITY_META[key].hint}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>
    </FormDialog>
  );
}

export function WithdrawNote({ id }: { id: string }) {
  return (
    <FormDialog
      trigger={<Button variant="ghost" className="min-h-11"><Undo2 aria-hidden="true" />Withdraw</Button>}
      title="Withdraw this note?"
      description="It stops showing on the record and in the person's hub. A superadmin can still see it in a subject export."
      submitLabel="Withdraw note"
      successMessage="Note withdrawn"
      submit={(formData) => withdrawNote(id, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why" htmlFor="hr-withdraw-reason">
        <Textarea id="hr-withdraw-reason" name="reason" rows={2} required minLength={3} maxLength={300} autoFocus />
      </Field>
    </FormDialog>
  );
}

export function StartReview({ subjectUserId, name }: { subjectUserId: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button variant="outline" className="min-h-11"><FilePlus2 aria-hidden="true" />Start a review</Button>}
      title={`Start a review for ${name}`}
      description="It stays a draft only you can see until you share it with them."
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

type Draft = { id: string; subjectUserId: string; period: string; summary: string; strengths: string; goals: string; overall: ReviewOverall | null };

/** The reviewer's editor for a draft. Saving keeps it private; sharing locks
 *  it and shows it to the person. */
export function ReviewEditor({ review, name }: { review: Draft; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  function save(form: HTMLFormElement) {
    const data = new FormData(form);
    setMessage(null);
    start(async () => {
      const result = await saveReview(review.id, review.subjectUserId, {
        period: String(data.get("period") ?? ""), summary: String(data.get("summary") ?? ""),
        strengths: String(data.get("strengths") ?? ""), goals: String(data.get("goals") ?? ""), overall: String(data.get("overall") ?? "") as ReviewOverall | "",
      });
      setMessage(result.ok ? { tone: "info", text: "Draft saved. Only you can see it." } : { tone: "error", text: result.error });
      if (result.ok) router.refresh();
    });
  }
  return (
    <form className="flex flex-col gap-4 rounded-ui-lg border border-ui-border p-5" onSubmit={(event) => { event.preventDefault(); save(event.currentTarget); }} aria-labelledby="review-editor">
      <h2 id="review-editor" className="text-lg font-semibold">Draft</h2>
      <div className="space-y-2"><Label htmlFor="rv-period">Review period</Label><Input id="rv-period" name="period" defaultValue={review.period} required minLength={2} maxLength={80} className="min-h-11" /></div>
      <div className="space-y-2"><Label htmlFor="rv-summary">Summary</Label><Textarea id="rv-summary" name="summary" defaultValue={review.summary} rows={5} maxLength={5000} /></div>
      <div className="space-y-2"><Label htmlFor="rv-strengths">Strengths</Label><Textarea id="rv-strengths" name="strengths" defaultValue={review.strengths} rows={4} maxLength={5000} /></div>
      <div className="space-y-2"><Label htmlFor="rv-goals">Goals for the next period</Label><Textarea id="rv-goals" name="goals" defaultValue={review.goals} rows={4} maxLength={5000} /></div>
      <div className="space-y-2"><Label htmlFor="rv-overall">Overall (optional)</Label>
        <NativeSelect id="rv-overall" name="overall" defaultValue={review.overall ?? ""} className="min-h-11 w-full">
          <NativeSelectOption value="">Not stated</NativeSelectOption>
          {Object.entries(REVIEW_OVERALL_LABELS).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      {message ? <Notice tone={message.tone} title={message.text} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" className="min-h-11" disabled={pending}><Save aria-hidden="true" />Save draft</Button>
        <ShareReview id={review.id} name={name} />
      </div>
    </form>
  );
}

function ShareReview({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button type="button" className="min-h-11"><Send aria-hidden="true" />Share with {name.split(" ")[0]}</Button>}
      title={`Share this review with ${name}?`}
      description="Save your latest changes first. Once shared it cannot be edited; they see it in their My hub and can add a comment when they acknowledge it."
      submitLabel="Share review"
      successMessage="Review shared"
      submit={() => shareReview(id)}
    >
      <p className="sr-only">Confirm to share.</p>
    </FormDialog>
  );
}

export function AcknowledgeReview({ id, period }: { id: string; period: string }) {
  return (
    <FormDialog
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />Acknowledge</Button>}
      title={`Acknowledge ${period}?`}
      description="This says you have read it, not that you agree with every word. Your comment is added to the review."
      submitLabel="Acknowledge"
      successMessage="Review acknowledged"
      submit={(formData) => acknowledgeReview(id, String(formData.get("comment") ?? ""))}
    >
      <Field label="Your comment (optional)" htmlFor="hr-ack-comment">
        <Textarea id="hr-ack-comment" name="comment" rows={4} maxLength={2000} />
      </Field>
    </FormDialog>
  );
}
