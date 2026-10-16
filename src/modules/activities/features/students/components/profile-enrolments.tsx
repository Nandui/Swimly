"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { useId, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/ui/textarea";
import { endEnrolment, enrolStudent, promoteFromWaitlist, transferEnrolment } from "@/modules/activities/shared/enrolment/actions/enrolment";
import { scheduleUnenrolment } from "@/modules/activities/shared/enrolment/actions/schedule";
import type { StudentEnrolment, TransferTarget } from "@/modules/activities/shared/enrolment/data/enrolments";
import { courseLabelWithSite, formatSlotShort } from "@/modules/activities/shared/courses/constants";
import { ENROLMENT_STATUS_META } from "@/modules/activities/shared/enrolment/constants";
import { formatDate, formatDay, parseDateOnly, today } from "@/lib/format";
import { Select as LessonSelect } from "@/components/ui/select";
import { LeaveReasonField } from "@/modules/activities/shared/enrolment/components/leave-reason-field";
import { lastLessonBefore, upcomingLessons } from "@/modules/activities/shared/enrolment/last-lesson";
import { ProfileActionDialog } from "@/modules/activities/features/students/components/profile-action-dialog";
import { ClassEnrolmentDialog } from "@/modules/activities/features/students/components/class-enrolment-dialog";
import { LegendAgreementField } from "@/modules/activities/shared/enrolment/components/legend-agreement-field";
import { readLegendAgreement } from "@/modules/activities/shared/enrolment/legend-agreement";

export function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function LeavePlace({ enrolment }: { enrolment: StudentEnrolment }) {
  const [when, setWhen] = useState(enrolment.scheduledEndOn ? "date" : "now"), [finished, setFinished] = useState(false), id = useId();
  const lessons = upcomingLessons(enrolment.course.dayOfWeek, enrolment.startedOn, today());
  const saved = enrolment.scheduledEndOn ? lastLessonBefore(enrolment.course.dayOfWeek, enrolment.scheduledEndOn) : undefined;
  // A saved lesson beyond the picker's reach stays choosable.
  if (saved && saved > lessons[lessons.length - 1]) lessons.push(saved);
  return <ProfileActionDialog trigger={<Button variant="outline">{enrolment.scheduledEndOn ? "Change last lesson" : "Unenrol"}</Button>}
    title="End this enrolment" description={`${courseLabelWithSite(enrolment.course)}. Their attendance and progress stay on record.`} submitLabel="Confirm change"
    submit={data => when === "date" ? scheduleUnenrolment(enrolment.id, String(data.get("lastLesson") ?? ""), String(data.get("leaveReason") ?? "")) : when === "keep" ? scheduleUnenrolment(enrolment.id, null) : endEnrolment(enrolment.id, { status: data.get("finished") === "on" ? "COMPLETED" : "WITHDRAWN", note: String(data.get("note") ?? ""), leaveReason: String(data.get("leaveReason") ?? "") })}>
    {enrolment.status === "ACTIVE" ? <ProfileField label="When"><Select value={when} onValueChange={setWhen}><SelectTrigger aria-label="When to end enrolment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Now</SelectItem><SelectItem value="date">After a lesson</SelectItem>{enrolment.scheduledEndOn ? <SelectItem value="keep">Keep this place</SelectItem> : null}</SelectContent></Select></ProfileField> : null}
    {when === "date" ? <LessonSelect name="lastLesson" label="Last lesson" description="They stay enrolled up to and including this lesson. Their place frees up the day after." required placeholder="Pick their last lesson" defaultValue={saved && lessons.includes(saved) ? saved : undefined} options={lessons.map(iso => ({ value: iso, label: formatDay(iso) }))} /> : null}
    {when === "date" ? <LeaveReasonField defaultValue={enrolment.leaveReason} /> : when === "keep" ? <p className="text-sm">The scheduled end is cancelled and the swimmer keeps their place.</p> : <><Label htmlFor={id} className="min-h-11"><Checkbox name="finished" id={id} checked={finished} onCheckedChange={value => setFinished(value === true)} />They finished the class</Label>{enrolment.status === "ACTIVE" && !finished ? <LeaveReasonField defaultValue={enrolment.leaveReason} /> : null}<ProfileField label="Note"><Textarea aria-label="Note" name="note" maxLength={300} rows={2} /></ProfileField></>}
  </ProfileActionDialog>;
}

export function ManageProfileEnrolments({ studentId, active, enrolments, targets }: { studentId: string; active: boolean; enrolments: StudentEnrolment[]; targets: TransferTarget[] }) {
  const current = enrolments.filter(e => e.status === "ACTIVE" || e.status === "WAITLISTED");
  return <Dialog><DialogTrigger asChild><Button>Manage enrolment</Button></DialogTrigger>
    <DialogContent className="max-h-(--pc-overlay-max-height) overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Manage enrolment</DialogTitle><DialogDescription>Current places at every site. Moves keep the swimmer’s history.</DialogDescription></DialogHeader>
      {current.length ? <ul className="pc-rows">{current.map(e => <li key={e.id} className="pc-row"><div className="pc-row-body"><p className="pc-row-title">{e.level.name} · {e.course.club.name}</p><p className="pc-row-hint">{formatSlotShort(e.course)}{e.scheduledEndOn ? ` · Last lesson ${formatDate(parseDateOnly(lastLessonBefore(e.course.dayOfWeek, e.scheduledEndOn)))}` : ""}</p></div><div className="pc-row-trail"><Tag meta={ENROLMENT_STATUS_META[e.status]} /></div>
        <div className="flex basis-full flex-wrap gap-2">
          <ClassEnrolmentDialog trigger={<Button variant="outline">Move class</Button>} courses={targets.filter(c => c.id !== e.course.id)} currentEnrolment={e}
            submit={(data, confirmation) => transferEnrolment(e.id, String(data.get("toCourseId") ?? ""), String(data.get("placementReason") ?? ""), confirmation)} />
          {e.status === "WAITLISTED" ? <ProfileActionDialog trigger={<Button variant="outline">Enrol from waitlist</Button>} title="Enrol from the waitlist" description={`Activate the place in ${courseLabelWithSite(e.course)} if a space is available.`} submitLabel="Enrol" submit={data => promoteFromWaitlist(e.id, readLegendAgreement(data))}><LegendAgreementField /></ProfileActionDialog> : null}
          <LeavePlace enrolment={e} />
        </div></li>)}</ul> : <EmptyState compact title="No current enrolments or waitlist places" />}
      {active ? <ClassEnrolmentDialog trigger={<Button className="justify-self-start">Enrol in a class</Button>} courses={targets}
        submit={(data, confirmation) => enrolStudent({ studentId, courseId: String(data.get("courseId") ?? ""), placementReason: String(data.get("placementReason") ?? ""), allowWaitlist: data.get("allowWaitlist") === "on", legendAgreement: readLegendAgreement(data) }, confirmation)} /> : <p className="text-sm text-ui-muted-foreground">Reactivate this swimmer before adding a place.</p>}
    </DialogContent>
  </Dialog>;
}
