"use client";

import { useId, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/ui/textarea";
import { endEnrolment, enrolStudent, promoteFromWaitlist, transferEnrolment } from "@/lib/enrolment/actions/enrolment";
import { scheduleUnenrolment } from "@/lib/enrolment/actions/schedule";
import type { StudentEnrolment, TransferTarget } from "@/lib/enrolment/data/enrolments";
import { courseLabelWithSite, formatSlotShort } from "@/lib/courses/constants";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import { formatDate, toDateOnlyString } from "@/lib/format";
import { ProfileActionDialog } from "./profile-action-dialog";
import { ClassEnrolmentDialog } from "./class-enrolment-dialog";
import { LegendAgreementField } from "@/components/enrolment/legend-agreement-field";
import { readLegendAgreement } from "@/lib/enrolment/legend-agreement";

export function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function LeavePlace({ enrolment }: { enrolment: StudentEnrolment }) {
  const [when, setWhen] = useState(enrolment.scheduledEndOn ? "date" : "now"), id = useId();
  return <ProfileActionDialog trigger={<Button variant="outline" size="sm">{enrolment.scheduledEndOn ? "Change end date" : "Unenrol"}</Button>}
    title="End this enrolment" description={`${courseLabelWithSite(enrolment.course)}. Their attendance and progress stay on record.`} submitLabel="Confirm change"
    submit={data => when === "date" ? scheduleUnenrolment(enrolment.id, String(data.get("endDate") ?? "")) : when === "keep" ? scheduleUnenrolment(enrolment.id, null) : endEnrolment(enrolment.id, { status: data.get("finished") === "on" ? "COMPLETED" : "WITHDRAWN", note: String(data.get("note") ?? "") })}>
    {enrolment.status === "ACTIVE" ? <ProfileField label="When"><Select value={when} onValueChange={setWhen}><SelectTrigger aria-label="When to end enrolment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Now</SelectItem><SelectItem value="date">On a date</SelectItem>{enrolment.scheduledEndOn ? <SelectItem value="keep">Keep this place</SelectItem> : null}</SelectContent></Select></ProfileField> : null}
    {when === "date" ? <Input aria-label="End date" name="endDate" type="date" required defaultValue={enrolment.scheduledEndOn ? toDateOnlyString(enrolment.scheduledEndOn) : ""} /> : when === "keep" ? <p className="text-sm">The scheduled end is cancelled and the swimmer keeps their place.</p> : <><Label htmlFor={id} className="min-h-11"><Checkbox name="finished" id={id} />They finished the class</Label><ProfileField label="Reason or note"><Textarea aria-label="Reason or note" name="note" maxLength={300} rows={2} /></ProfileField></>}
  </ProfileActionDialog>;
}

export function ManageProfileEnrolments({ studentId, active, enrolments, targets }: { studentId: string; active: boolean; enrolments: StudentEnrolment[]; targets: TransferTarget[] }) {
  const current = enrolments.filter(e => e.status === "ACTIVE" || e.status === "WAITLISTED");
  return <Dialog><DialogTrigger asChild><Button>Manage enrolment</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Manage enrolment</DialogTitle><DialogDescription>Current places at both sites. Moves preserve the swimmer’s history.</DialogDescription></DialogHeader>
      {current.length ? <ul className="divide-y divide-ui-border">{current.map(e => <li key={e.id} className="space-y-3 py-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{e.level.name} · {e.course.club.name}</p><p className="text-sm text-ui-muted-foreground">{formatSlotShort(e.course)}</p></div><Badge variant="secondary" data-tone={ENROLMENT_STATUS_META[e.status].color}>{ENROLMENT_STATUS_META[e.status].label}</Badge></div>
        {e.scheduledEndOn ? <p className="text-sm">Ends {formatDate(e.scheduledEndOn)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ClassEnrolmentDialog trigger={<Button variant="outline" size="sm">Move class</Button>} courses={targets.filter(c => c.id !== e.course.id)} currentEnrolment={e}
            submit={(data, confirmation) => transferEnrolment(e.id, String(data.get("toCourseId") ?? ""), String(data.get("placementReason") ?? ""), confirmation)} />
          {e.status === "WAITLISTED" ? <ProfileActionDialog trigger={<Button variant="outline" size="sm">Enrol from waitlist</Button>} title="Enrol from the waitlist" description={`Activate the place in ${courseLabelWithSite(e.course)} if a space is available.`} submitLabel="Enrol" submit={data => promoteFromWaitlist(e.id, readLegendAgreement(data))}><LegendAgreementField /></ProfileActionDialog> : null}
          <LeavePlace enrolment={e} />
        </div></li>)}</ul> : <p className="py-4 text-sm text-ui-muted-foreground">No current enrolments or waitlist places.</p>}
      {active ? <ClassEnrolmentDialog trigger={<Button className="justify-self-start">Enrol in a class</Button>} courses={targets}
        submit={(data, confirmation) => enrolStudent({ studentId, courseId: String(data.get("courseId") ?? ""), placementReason: String(data.get("placementReason") ?? ""), allowWaitlist: data.get("allowWaitlist") === "on", legendAgreement: readLegendAgreement(data) }, confirmation)} /> : <p className="text-sm text-ui-muted-foreground">Reactivate this swimmer before adding a place.</p>}
    </DialogContent>
  </Dialog>;
}
