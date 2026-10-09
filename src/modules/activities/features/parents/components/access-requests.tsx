"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { RefreshCw } from "lucide-react";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { StudentSearch } from "@/modules/activities/shared/students/components/student-search";
import type { StudentHit } from "@/modules/activities/shared/students/actions/search";
import { ACCESS_REQUEST_META, type AccessReview, parentDateTime, saveParentAdmin } from "@/modules/activities/shared/parents/admin-client";
import { ParentFormDialog, ParentLoadState, ParentReason } from "@/modules/activities/shared/parents/components/parent-fields";
import { useParentResource } from "@/modules/activities/shared/parents/components/use-parent-resource";
import { LoadingButton } from "@/components/ui/loading-button";
import { formatDate, parseDateOnly } from "@/lib/format";

/** The API sends a date-only day (or a full ISO instant); show it as a day. */
const birthDate = (value: string) => formatDate(parseDateOnly(value.slice(0, 10)));

function Review({ request, approved, onSuccess }: { request: AccessReview; approved: boolean; onSuccess: () => void }) {
  const [student, setStudent] = useState<StudentHit | null>(null);
  const decision = approved ? "APPROVED" : "DECLINED";
  return <ParentFormDialog
    trigger={<Button variant={approved ? "default" : "outline"} className="min-h-11" disabled={approved && !request.parent.isActive}>{approved ? "Review and approve" : "Decline request"}</Button>}
    title={approved ? "Approve access to a swimmer" : "Decline this request"}
    description={approved ? "Verify the parent’s relationship to the selected swimmer before granting access to their progress." : "Explain what the parent should check or do next. They will see your reply in their account."}
    submitLabel={approved ? "Approve and link swimmer" : "Decline request"}
    successMessage={approved ? "Swimmer linked. The parent can now see their progress." : "Request declined. Your reply is available to the parent."}
    onSuccess={onSuccess}
    submit={data => {
      if (approved && !student) return Promise.resolve({ ok: false as const, error: "Choose the existing swimmer before approving access." });
      return saveParentAdmin(`access-requests/${request.id}`, "PATCH", { decision, ...(approved ? { studentId: student!.id } : {}), reason: String(data.get("reason") ?? ""), reply: String(data.get("reply") ?? "") });
    }}>
    <div className="pc-note text-sm"><div className="min-w-0 space-y-1">
      <p className="font-semibold">{request.parent.name || "Parent"}</p><p className="break-all">{request.parent.email}</p>
      <p>Requesting {request.firstName} {request.lastName} · born {birthDate(request.dateOfBirth)}</p>
    </div></div>
    {approved && <>
      <StudentSearch label="Match to an existing swimmer" selected={student} onSelect={setStudent} includeInactive description="Search across every site. Check the swimmer’s profile and your records to verify this parent." />
      {student && <p className="text-sm"><Link href={`/students/${student.id}`} target="_blank" className="inline-flex min-h-11 items-center text-ui-primary underline">Check {student.firstName} {student.lastName}’s profile (new tab)</Link></p>}
    </>}
    <Textarea name="reply" label="Reply to the parent" description="Visible in the parent app. Keep internal checks in the reason below." required minLength={3} maxLength={500}
      defaultValue={approved ? "Your child is now linked. Open My children to see their progress." : ""} />
    <ParentReason />
  </ParentFormDialog>;
}

export function ParentAccessRequests() {
  const [status, setStatus] = useState<keyof typeof ACCESS_REQUEST_META>("PENDING");
  const [page, setPage] = useState(1);
  const resource = useParentResource<{ items: AccessReview[]; total: number; pendingCount: number }>(`access-requests?status=${status}&page=${page}`);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const focusAfterReview = useRef(false);
  useEffect(() => {
    if (!resource.loading && focusAfterReview.current) {
      focusAfterReview.current = false;
      refreshButton.current?.focus();
    }
  }, [resource.loading]);
  function reviewed() { focusAfterReview.current = true; resource.reload(); }
  return <section aria-labelledby="access-requests-heading" className="pc-panel">
    <div className="min-w-0">
      <h2 id="access-requests-heading">Parent access requests{resource.data ? ` (${resource.data.pendingCount} waiting)` : ""}</h2>
      <p className="pc-row-hint">Families from every site. Match each request to an existing swimmer before approving.</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedChoice aria-label="Request status" value={status} onValueChange={value => { setStatus(value as keyof typeof ACCESS_REQUEST_META); setPage(1); }}
        options={(Object.keys(ACCESS_REQUEST_META) as Array<keyof typeof ACCESS_REQUEST_META>).map(value => ({ value, label: ACCESS_REQUEST_META[value].label }))} />
      <LoadingButton ref={refreshButton} variant="outline" pending={resource.loading} pendingLabel="Refreshing…" onClick={resource.reload}><RefreshCw aria-hidden="true" />Refresh</LoadingButton>
    </div>
    <ParentLoadState {...resource} />
    {resource.data && <div aria-live="polite" className="flex flex-col gap-4">
      {!resource.data.items.length && <EmptyState compact title={status === "PENDING" ? "No requests waiting for review" : "No requests in this view"} />}
      {resource.data.items.length ? <ul className="pc-rows">{resource.data.items.map(request => <li key={request.id} className="pc-row">
        <div className="pc-row-body basis-64">
          <h3 className="pc-row-title break-words">{request.firstName} {request.lastName}</h3>
          <p className="pc-row-hint">Date of birth: {birthDate(request.dateOfBirth)} · Requested by {request.parent.name || "a parent (name not supplied)"}</p>
          <p className="pc-row-hint break-all">{request.parent.email} · {request.parent.phone || "No phone supplied"}</p>
          <p className="pc-row-hint whitespace-pre-wrap break-words">Lesson details from parent: {request.context || "Not supplied"}</p>
          <p className="pc-row-hint">Sent {parentDateTime(request.createdAt)}{request.reviewedAt && ` · Reviewed by ${request.reviewedByName} on ${parentDateTime(request.reviewedAt)}`}</p>
          {!request.parent.isActive && <p className="pc-row-hint font-semibold">Parent account suspended. Approval is unavailable.</p>}
        </div>
        <div className="pc-row-trail">
          {request.status === "PENDING" ? <><Review request={request} approved={false} onSuccess={reviewed} /><Review request={request} approved onSuccess={reviewed} /></>
            : <><Tag meta={ACCESS_REQUEST_META[request.status]} />{request.student && <Button asChild variant="ghost" className="min-h-11"><Link href={`/students/${request.student.id}`}>Open {request.student.firstName} {request.student.lastName}’s profile</Link></Button>}</>}
        </div>
        {request.reply && <div className="pc-note basis-full text-sm"><div className="min-w-0 space-y-1"><p className="font-semibold">Reply to parent</p><p className="whitespace-pre-wrap break-words">{request.reply}</p></div></div>}
      </li>)}</ul> : null}
      <LinkPagination label="Request pages" page={page} totalItems={resource.data.total} pageSize={20} onPage={setPage} />
    </div>}
  </section>;
}
