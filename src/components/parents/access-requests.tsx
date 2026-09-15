"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Textarea } from "@/components/ui/textarea";
import { StudentSearch } from "@/components/students/student-search";
import type { StudentHit } from "@/lib/students/actions/search";
import { ACCESS_REQUEST_META, type AccessReview, parentDateTime, saveParentAdmin } from "@/lib/parent/admin-client";
import { ParentFormDialog, ParentLoadState, ParentReason } from "./parent-fields";
import { useParentResource } from "./use-parent-resource";

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
    <div className="space-y-1 rounded-ui-md bg-ui-muted p-3 text-sm">
      <p className="font-semibold">{request.parent.name || "Parent"}</p><p className="break-all">{request.parent.email}</p>
      <p>Requesting {request.firstName} {request.lastName} · born {request.dateOfBirth}</p>
    </div>
    {approved && <>
      <StudentSearch label="Match to an existing swimmer" selected={student} onSelect={setStudent} includeInactive description="Search across both sites. Check the swimmer’s profile and your records to verify this parent." />
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
  return <section aria-labelledby="access-requests-heading" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="access-requests-heading" className="text-xl font-semibold">Parent access requests{resource.data ? ` (${resource.data.pendingCount} waiting)` : ""}</h2>
        <p className="mt-1 text-sm text-ui-muted-foreground">Families from both sites. Match each request to an existing swimmer before approving.</p></div>
      <Button ref={refreshButton} variant="outline" className="min-h-11" onClick={resource.reload}>Refresh requests</Button>
    </div>
    <div role="group" aria-label="Request status" className="flex flex-wrap gap-2">
      {(Object.keys(ACCESS_REQUEST_META) as Array<keyof typeof ACCESS_REQUEST_META>).map(value => <Button key={value} variant={value === status ? "secondary" : "ghost"} className="min-h-11" aria-pressed={value === status} onClick={() => { setStatus(value); setPage(1); }}>{ACCESS_REQUEST_META[value].label}</Button>)}
    </div>
    <ParentLoadState {...resource} />
    {resource.data && <div aria-live="polite" className="space-y-4">
      {!resource.data.items.length && <p className="rounded-ui-lg border border-dashed border-ui-border p-6 text-sm text-ui-muted-foreground">{status === "PENDING" ? "No requests waiting for review." : "No requests in this view."}</p>}
      {resource.data.items.map(request => <article key={request.id} className="space-y-4 rounded-ui-lg border border-ui-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="break-words text-lg font-semibold">{request.firstName} {request.lastName}</h3><p className="text-sm text-ui-muted-foreground">Date of birth: {request.dateOfBirth} · Parent-supplied details</p></div>
          <Badge variant="secondary" data-tone={ACCESS_REQUEST_META[request.status].color}>{ACCESS_REQUEST_META[request.status].label}</Badge>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="text-ui-muted-foreground">Requested by</dt><dd className="mt-1 break-words font-medium">{request.parent.name || "Name not supplied"}</dd><dd className="break-all">{request.parent.email}</dd><dd>{request.parent.phone || "No phone supplied"}</dd></div>
          <div><dt className="text-ui-muted-foreground">Lesson details from parent</dt><dd className="mt-1 whitespace-pre-wrap break-words">{request.context || "Not supplied"}</dd></div>
        </dl>
        {!request.parent.isActive && <p className="text-sm font-medium">Parent account suspended. Approval is unavailable.</p>}
        {request.reply && <div className="rounded-ui-md bg-ui-muted p-3 text-sm"><p className="font-semibold">Reply to parent</p><p className="mt-1 whitespace-pre-wrap break-words">{request.reply}</p></div>}
        {request.student && <Button asChild variant="link" className="min-h-11 px-0"><Link href={`/students/${request.student.id}`}>Open {request.student.firstName} {request.student.lastName}’s profile</Link></Button>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ui-muted-foreground">Sent {parentDateTime(request.createdAt)}{request.reviewedAt && ` · Reviewed by ${request.reviewedByName} on ${parentDateTime(request.reviewedAt)}`}</p>
          {request.status === "PENDING" && <div className="flex flex-wrap gap-2"><Review request={request} approved onSuccess={reviewed} /><Review request={request} approved={false} onSuccess={reviewed} /></div>}
        </div>
      </article>)}
      {resource.data.total > 20 && <div className="flex items-center gap-3"><Button variant="outline" className="min-h-11" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><p className="text-sm">Page {page} of {Math.ceil(resource.data.total / 20)}</p><Button variant="outline" className="min-h-11" disabled={page * 20 >= resource.data.total} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>}
  </section>;
}
