"use client";

import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Textarea } from "@/components/shadcn/textarea";
import { endEnrolment, enrolStudent, promoteFromWaitlist, transferEnrolment } from "@/lib/enrolment/actions/enrolment";
import { scheduleUnenrolment } from "@/lib/enrolment/actions/schedule";
import type { StudentEnrolment, TransferTarget } from "@/lib/enrolment/data/enrolments";
import { courseLabelWithSite, formatSlotShort } from "@/lib/courses/constants";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import { formatDate, toDateOnlyString } from "@/lib/format";
import { ProfileActionDialog } from "./profile-action-dialog";

export function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function ClassPicker({ courses, name }: { courses: TransferTarget[]; name: string }) {
  const [value, setValue] = useState(""), [open, setOpen] = useState(false);
  const selected = courses.find(c => c.id === value);
  return <div className="space-y-2"><Label>Class</Label><input type="hidden" name={name} value={value} />
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" role="combobox" aria-label="Choose class" aria-expanded={open} variant="outline" className="h-auto min-h-11 w-full justify-between whitespace-normal text-left">{selected ? courseLabelWithSite(selected) : "Choose a class at either site"}<ChevronsUpDown aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent className="w-[min(36rem,calc(100vw-3rem))] p-0"><Command><CommandInput placeholder="Search class, site, level or day…" aria-label="Search classes" /><CommandList><CommandEmpty>No classes match.</CommandEmpty>{courses.map(course => <CommandItem key={course.id} value={course.id} keywords={[courseLabelWithSite(course)]} onSelect={() => { setValue(course.id); setOpen(false); }} className="min-h-11 items-start"><span className="min-w-0 whitespace-normal">{courseLabelWithSite(course)}<small className="block text-ui-muted-foreground">{course.capacity === null ? "Uncapped" : `${Math.max(0, course.capacity - course._count.enrolments)} spaces available`}</small></span>{value === course.id ? <Check aria-hidden="true" /> : null}</CommandItem>)}</CommandList></Command></PopoverContent>
    </Popover>
  </div>;
}
function PlacementReason() {
  return <ProfileField label="Placement reason, if the level has not been earned"><Textarea name="placementReason" aria-label="Placement reason" rows={2} maxLength={300} /></ProfileField>;
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
  const id = useId();
  const current = enrolments.filter(e => e.status === "ACTIVE" || e.status === "WAITLISTED");
  return <Dialog><DialogTrigger asChild><Button>Manage enrolment</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Manage enrolment</DialogTitle><DialogDescription>Current places at both sites. Moves preserve the swimmer’s history.</DialogDescription></DialogHeader>
      {current.length ? <ul className="divide-y divide-ui-border">{current.map(e => <li key={e.id} className="space-y-3 py-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{e.level.name} · {e.course.club.name}</p><p className="text-sm text-ui-muted-foreground">{formatSlotShort(e.course)}</p></div><Badge variant="secondary" data-tone={ENROLMENT_STATUS_META[e.status].color}>{ENROLMENT_STATUS_META[e.status].label}</Badge></div>
        {e.scheduledEndOn ? <p className="text-sm">Ends {formatDate(e.scheduledEndOn)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ProfileActionDialog trigger={<Button variant="outline" size="sm">Move class</Button>} title="Move to another class" description={`From ${courseLabelWithSite(e.course)}. Review the destination before confirming.`} submitLabel="Review move" success="Swimmer moved" submit={(data, confirmation) => transferEnrolment(e.id, String(data.get("toCourseId") ?? ""), String(data.get("placementReason") ?? ""), confirmation)}><ClassPicker courses={targets.filter(c => c.id !== e.course.id)} name="toCourseId" /><PlacementReason /></ProfileActionDialog>
          {e.status === "WAITLISTED" ? <ProfileActionDialog trigger={<Button variant="outline" size="sm">Enrol from waitlist</Button>} title="Enrol from the waitlist" description={`Activate the place in ${courseLabelWithSite(e.course)} if a space is available.`} submitLabel="Enrol" submit={() => promoteFromWaitlist(e.id)}><p className="text-sm">The class capacity will be checked before saving.</p></ProfileActionDialog> : null}
          <LeavePlace enrolment={e} />
        </div></li>)}</ul> : <p className="py-4 text-sm text-ui-muted-foreground">No current enrolments or waitlist places.</p>}
      {active ? <ProfileActionDialog trigger={<Button className="justify-self-start">Enrol in a class</Button>} title="Enrol in a class" description="Search classes across both sites. Existing places are reviewed before any changes." submitLabel="Review enrolment" success="Enrolment saved"
        submit={(data, confirmation) => enrolStudent({ studentId, courseId: String(data.get("courseId") ?? ""), placementReason: String(data.get("placementReason") ?? ""), allowWaitlist: data.get("allowWaitlist") === "on" }, confirmation)}><ClassPicker courses={targets} name="courseId" /><PlacementReason /><Label htmlFor={id} className="min-h-11"><Checkbox id={id} name="allowWaitlist" />Join the waitlist if full</Label></ProfileActionDialog> : <p className="text-sm text-ui-muted-foreground">Reactivate this swimmer before adding a place.</p>}
    </DialogContent>
  </Dialog>;
}
