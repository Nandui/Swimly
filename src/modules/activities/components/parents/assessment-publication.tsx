"use client";

import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Input } from "@/components/ui/input";
import { bookingDeadline, dublinDateTimeInput, parentDateTime, PUBLICATION_META, saveParentAdmin, type AssessmentPublication } from "@/modules/activities/lib/parent/admin-client";
import { ParentFormDialog, ParentReason, ParentLoadState } from "./parent-fields";
import { useParentResource } from "./use-parent-resource";

export function AssessmentPublicationPanel({ sessionId, sessionLabel, startsAt }: { sessionId: string; sessionLabel: string; startsAt: string }) {
  const path = `assessment-sessions/${encodeURIComponent(sessionId)}/publication`;
  const resource = useParentResource<AssessmentPublication>(path);
  const publication = resource.data;
  function saved() {
    resource.reload();
    requestAnimationFrame(() => document.getElementById("parent-booking-heading")?.focus());
  }
  const meta = PUBLICATION_META[!publication?.enabled ? "unpublished" : publication.visibleToParents ? "published" : "closed"];
  return <Card className="gap-4 p-4 shadow-none" role="region" aria-labelledby="parent-booking-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="parent-booking-heading" tabIndex={-1} >Parent booking</h2>
      {publication ? <Tag meta={meta} /> : null}
    </div>
    <ParentLoadState {...resource} />
    {publication ? <>
      <div className="max-w-prose space-y-2 text-sm text-ui-muted-foreground">
        <p>{publication.visibleToParents ? publication.spacesAvailable === 0
          ? "Visible to parents, but full. No more places can be booked."
          : "Parents can find this session and book an available place in the parent app."
          : publication.enabled ? "Parent booking is closed. Existing bookings remain on this session."
            : "Only staff can book this session until it is published to the parent app."}</p>
        {publication.enabled ? <p>Booking deadline: <span className="font-semibold text-ui-foreground">{parentDateTime(publication.bookingClosesAt ?? startsAt)}</span> · Ireland time</p> : null}
        {!publication.canPublish ? <p>This session cannot open for parent booking. It must be in the future, not cancelled, and use an active site, programme and assessment type.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {publication.canPublish ? <ParentFormDialog
          trigger={<Button variant={publication.enabled ? "outline" : "default"} className="min-h-11">{publication.enabled ? "Edit booking deadline" : "Publish to the parent app"}</Button>}
          title={publication.enabled ? "Edit parent booking deadline" : "Publish assessment to the parent app"}
          description="Parents will be able to find this session and book available places."
          submitLabel={publication.enabled ? "Save deadline" : "Publish session"}
          successMessage={publication.enabled ? "Parent booking deadline updated." : "Assessment published to the parent app."}
          submit={data => {
            let deadline: string | null;
            try { deadline = bookingDeadline(String(data.get("bookingClosesAt") ?? "")); }
            catch (error) {
              const message = (error as Error).message;
              return Promise.resolve({ ok: false, error: message, fieldErrors: { bookingClosesAt: message } });
            }
            return saveParentAdmin(path, "PUT", { enabled: true, bookingClosesAt: deadline, reason: String(data.get("reason") ?? "") });
          }} onSuccess={saved}>
          <div className="pc-note text-sm"><p className="min-w-0 font-semibold break-words">{sessionLabel}</p></div>
          <Input type="datetime-local" name="bookingClosesAt" label="Booking deadline (Ireland time)" defaultValue={dublinDateTimeInput(publication.bookingClosesAt)}
            max={dublinDateTimeInput(startsAt)} description="Leave blank to close bookings when the session starts. Choose a future time no later than the start." />
          <ParentReason />
        </ParentFormDialog> : null}
        {publication.enabled ? <ParentFormDialog
          trigger={<Button variant="outline" className="min-h-11">Unpublish</Button>}
          title="Unpublish assessment" description="Hide this session from parent booking. Existing bookings stay in place and staff can still manage them."
          submitLabel="Unpublish session" successMessage="Assessment unpublished from the parent app."
          submit={data => saveParentAdmin(path, "PUT", { enabled: false, reason: String(data.get("reason") ?? "") })} onSuccess={saved}>
          <div className="pc-note text-sm"><p className="min-w-0 font-semibold break-words">{sessionLabel}</p></div><ParentReason />
        </ParentFormDialog> : null}
        <Button variant="ghost" className="min-h-11" onClick={resource.reload}>Refresh status</Button>
      </div>
    </> : null}
  </Card>;
}
