"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronDown, Info, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Progress } from "@/components/shadcn/progress";
import { Badge } from "@/components/shadcn/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Input } from "@/components/shadcn/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import type { StudentDetail } from "@/lib/students/data/students";
import type { StudentEnrolment, TransferTarget } from "@/lib/enrolment/data/enrolments";
import type { ProgrammeProgress } from "@/lib/progression/data/progress";
import type { StudentAssessment } from "@/lib/assessments/data/assessments";
import { BOOKING_STATUS_META } from "@/lib/assessments/constants";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import { ageInYears, formatDate, parseDateOnly, toDateOnlyString } from "@/lib/format";
import { courseName, formatSlotShort, formatTime } from "@/lib/courses/constants";
import { fullName, STUDENT_STATUS_META } from "@/lib/students/constants";
import { swimmerProfileHref } from "@/lib/students/directory";
import { chapterOrder, HISTORY_KINDS, HISTORY_META, nextLesson, type HistoryKind, type HistoryPage } from "@/lib/students/history";
import { AddSwimmer } from "./add-swimmer";
import { ManageProfileEnrolments } from "./profile-enrolments";
import { ProfileCompetencies } from "./profile-competencies";
import { HistoryFeed } from "./profile-history";
import styles from "./swimmer-profile.module.css";

type Tab = "journey" | "competencies" | "attendance" | "assessments" | "details";
export type ProfileAccess = { edit: boolean; enrol: boolean; assess: boolean; complete: boolean; override: boolean; courses: boolean; assessments: boolean; audit: boolean };
export type SwimmerProfileProps = { student: StudentDetail; enrolments: StudentEnrolment[]; programmes: ProgrammeProgress[]; assessments: StudentAssessment[]; targets: TransferTarget[]; history: HistoryPage; access: ProfileAccess; initialTab?: string; returnTo: string; instant: string };
function profileTab(value?: string): Tab {
  if (value === "progress") return "competencies";
  return ["competencies", "attendance", "assessments", "details"].includes(value ?? "") ? value as Tab : "journey";
}

export function SwimmerProfile({ student, enrolments, programmes, assessments, targets, history, access, initialTab, returnTo, instant }: SwimmerProfileProps) {
  const [tab, setTab] = useState<Tab>(profileTab(initialTab)), [mode, setMode] = useState("milestones");
  const [programme, setProgramme] = useState("all"), [kind, setKind] = useState<HistoryKind>("all"), [query, setQuery] = useState("");
  const [search, setSearch] = useState(""), [level, setLevel] = useState<string | null>(null);
  const router = useRouter(), name = fullName(student);
  const chapters = chapterOrder(enrolments).filter(e => programme === "all" || e.programmeId === programme);
  const current = enrolments.filter(e => e.status === "ACTIVE");
  const next = nextLesson(enrolments, new Date(instant));
  const programmeOptions = [...new Map([...enrolments.map(e => [e.programmeId, e.programme.name] as const), ...programmes.map(p => [p.programmeId, p.programmeName] as const)]).entries()];
  function navigate(next: Tab) { setTab(next); router.replace(swimmerProfileHref(student.id, returnTo, next), { scroll: false }); }
  function showCompetencies(id: string) { setLevel(id); navigate("competencies"); }
  return <article className={styles.profile} data-swimmer-profile>
    <Button asChild variant="link" className="min-h-11 self-start px-0 text-ui-muted-foreground hover:text-ui-foreground has-[>svg]:px-0"><a href={returnTo}><ArrowLeft className="size-4" aria-hidden="true" />Swimmers</a></Button>
    <header className={styles.header}>
      <div className={styles.identity}><Avatar className={styles.avatar} aria-hidden="true"><AvatarFallback className="text-[inherit]">{student.firstName.slice(0, 1)}{student.lastName.slice(0, 1)}</AvatarFallback></Avatar><div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{name}</h1><p className="mt-2 text-sm text-ui-muted-foreground">{student.dateOfBirth ? `Age ${ageInYears(student.dateOfBirth, new Date(instant))} · ` : ""}{student.memberNumber ? `Member ${student.memberNumber} · ` : ""}Joined {formatDate(student.joinedOn)}</p>{student.status !== "ACTIVE" ? <Badge variant="secondary" data-tone={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Badge> : null}</div></div>
      <div className="flex flex-wrap gap-2">{access.edit ? <AddSwimmer student={student} /> : null}{access.enrol ? <ManageProfileEnrolments studentId={student.id} active={student.status === "ACTIVE"} enrolments={enrolments} targets={targets} /> : null}</div>
    </header>
    {student.medicalNotes ? <Alert variant="destructive"><AlertTitle>Medical notes — read before swimming</AlertTitle><AlertDescription className="whitespace-pre-wrap">{student.medicalNotes}</AlertDescription></Alert> : null}
    <Tabs value={tab} onValueChange={value => navigate(value as Tab)} className="gap-0">
      <TabsList variant="line" className={styles.tabs} aria-label="Swimmer profile sections"><TabsTrigger value="journey">Journey</TabsTrigger><TabsTrigger value="competencies">Competencies</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="assessments">Assessments</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger></TabsList>
      <div className={styles.body}>
        <div className="min-w-0">
          <TabsContent value="journey" className="m-0 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Every chapter, from their first swim</h2><p className="mt-1 text-sm text-ui-muted-foreground">Classes, progress and activity across both sites.</p></div>
              <div className="flex flex-wrap items-center gap-2"><div role="group" aria-label="Journey display" className="flex rounded-ui-lg bg-ui-muted p-1"><Button variant={mode === "milestones" ? "outline" : "ghost"} aria-pressed={mode === "milestones"} onClick={() => setMode("milestones")}>Milestones</Button><Button variant={mode === "activity" ? "outline" : "ghost"} aria-pressed={mode === "activity"} onClick={() => setMode("activity")}>All activity</Button></div><Select value={programme} onValueChange={setProgramme}><SelectTrigger aria-label="Filter by programme"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All programmes</SelectItem>{programmeOptions.map(([id, label]) => <SelectItem value={id} key={id}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {mode === "milestones" ? <div className={styles.chapters}>
              {chapters.map(e => {
                const progress = programmes.find(p => p.programmeId === e.programmeId)?.levels.find(l => l.id === e.levelId);
                const meta = ENROLMENT_STATUS_META[e.status];
                return <div className={styles.chapterRow} key={e.id}><time className={styles.year} dateTime={toDateOnlyString(e.startedOn)}>{e.startedOn.getUTCFullYear()}</time>
                  <Collapsible defaultOpen={e.id === chapters[0]?.id} className={styles.chapter} data-current={e.status === "ACTIVE"}>
                    <CollapsibleTrigger asChild><button className={styles.chapterTrigger} aria-label={`${e.level.name}, ${e.course.club.name}, ${meta.label}`}><span className="min-w-0"><span className="block text-xs uppercase tracking-wide text-ui-muted-foreground">{formatDate(e.startedOn)} — {e.endedOn ? formatDate(e.endedOn) : e.status === "ACTIVE" || e.status === "WAITLISTED" ? "Present" : "End date not recorded"}</span><span className="mt-1 flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{e.level.name} · {e.course.club.name}</span><Badge variant="secondary" data-tone={meta.color}>{meta.label}</Badge></span><span className="mt-1 block text-sm text-ui-muted-foreground">{formatSlotShort(e.course)}{e.course.instructor ? ` · ${e.course.instructor.name}` : ""}</span></span><ChevronDown className="size-4 shrink-0" aria-hidden="true" /></button></CollapsibleTrigger>
                    <CollapsibleContent className={styles.chapterContent}>
                      {progress ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ui-border pb-4"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{progress.completionSnapshot ? `${progress.completionSnapshot.achieved} of ${progress.completionSnapshot.total} achieved at completion` : `${progress.achieved} of ${progress.total} competencies achieved${e.status === "ACTIVE" ? "" : " · current record"}`}</p><Progress className={styles.progress} value={100 * (progress.completionSnapshot?.achieved ?? progress.achieved) / Math.max(1, progress.completionSnapshot?.total ?? progress.total)} aria-valuetext={`${progress.completionSnapshot?.achieved ?? progress.achieved} of ${progress.completionSnapshot?.total ?? progress.total} achieved`} aria-label={`${e.level.name} competencies achieved`} /></div><Button variant="ghost" onClick={() => showCompetencies(e.levelId)}>View competencies</Button>{progress.completedOn ? <p className="basis-full text-xs text-ui-muted-foreground">Completed {formatDate(progress.completedOn)}{progress.confirmedByName ? ` · ${progress.confirmedByName}` : ""}</p> : null}</div> : null}
                      {e.placementReason ? <p className="mt-3 text-sm">Placement reason: {e.placementReason}</p> : null}
                      {e.scheduledEndOn ? <p className="mt-3 text-sm">Enrolment ends {formatDate(e.scheduledEndOn)}</p> : null}
                      <h3 className="mt-4 text-sm font-semibold">Activity in this class</h3><HistoryFeed studentId={student.id} query={{ courseId: e.course.id, from: toDateOnlyString(e.startedOn), ...(e.endedOn ? { to: toDateOnlyString(e.endedOn) } : {}) }} compact footer={access.courses ? <Button asChild variant="ghost"><a href={`/courses/${e.course.id}`}>Open class</a></Button> : null} />
                    </CollapsibleContent>
                  </Collapsible>
                </div>;
              })}
              {!chapters.length ? <p className="py-4 text-sm text-ui-muted-foreground">{enrolments.length ? "No enrolments in this programme." : "No class enrolments yet. Assessments and other records are available in All activity."}</p> : null}
              <div className={styles.chapterRow}><time className={styles.year}>{student.joinedOn.getUTCFullYear()}</time><div className="py-4"><h3 className="font-medium">Joined the swim school</h3><p className="mt-1 text-sm text-ui-muted-foreground">{formatDate(student.joinedOn)}</p>{assessments.length ? <Button variant="ghost" className="mt-2" onClick={() => navigate("assessments")}>View assessments and placements</Button> : null}</div></div>
            </div> : <div className="space-y-4"><form onSubmit={event => { event.preventDefault(); setSearch(query); }} className="flex flex-wrap gap-2"><Input aria-label="Search swimmer activity" placeholder="Search activity…" value={query} onChange={event => setQuery(event.target.value)} className="min-w-40 flex-1" /><Button type="submit" variant="outline">Search</Button><Select value={kind} onValueChange={value => setKind(value as HistoryKind)}><SelectTrigger aria-label="Activity type"><SelectValue /></SelectTrigger><SelectContent>{HISTORY_KINDS.map(value => <SelectItem value={value} key={value}>{HISTORY_META[value].label}</SelectItem>)}</SelectContent></Select></form><p className="text-xs text-ui-muted-foreground">Earlier records may contain only the latest mark or a summary. Detailed changes are retained from 12 September 2026.</p><HistoryFeed studentId={student.id} initial={kind === "all" && programme === "all" && !search ? history : undefined} query={{ kind, ...(programme !== "all" ? { programmeId: programme } : {}), q: search }} /></div>}
          </TabsContent>
          <TabsContent value="competencies" forceMount hidden={tab !== "competencies"} className="m-0"><ProfileCompetencies studentId={student.id} programmes={programmes} access={access} selectedLevel={level} /></TabsContent>
          <TabsContent value="attendance" className="m-0 space-y-3"><h2 className="text-xl font-semibold">Attendance history</h2><p className="text-sm text-ui-muted-foreground">Lesson dates, saved marks and corrections across both sites.</p><HistoryFeed studentId={student.id} query={{ kind: "attendance" }} /></TabsContent>
          <TabsContent value="assessments" className="m-0 space-y-3"><h2 className="text-xl font-semibold">Assessments and placements</h2>{assessments.length ? <ul className="divide-y divide-ui-border">{assessments.map(a => <li key={a.id} className="space-y-2 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{a.session.type?.name ?? "Assessment session"}</h3><Badge variant="secondary" data-tone={BOOKING_STATUS_META[a.status].color}>{BOOKING_STATUS_META[a.status].label}</Badge></div><p className="text-sm text-ui-muted-foreground">{formatDate(a.session.date)} · {formatTime(a.session.startMinutes)} · {a.session.club.name}</p><p className="text-sm">{a.session.programme.name}{a.outcomeLevel ? ` · Placed at ${a.outcomeLevel.name}` : ""}</p>{a.assessedByName ? <p className="text-xs text-ui-muted-foreground">{a.assessedByName}{a.assessedOn ? ` · ${formatDate(a.assessedOn)}` : ""}</p> : null}{a.outcomeNote ? <p className="text-sm">{a.outcomeNote}</p> : null}{a.session.cancelledAt ? <p className="text-sm">Session cancelled</p> : null}{access.assessments ? <Button variant="ghost" asChild><a href={`/assessments/${a.session.id}`}>Open assessment</a></Button> : null}</li>)}</ul> : <p className="text-sm text-ui-muted-foreground">No assessment bookings recorded.</p>}<HistoryFeed studentId={student.id} query={{ kind: "assessment" }} /></TabsContent>
          <TabsContent value="details" className="m-0"><ProfileDetails student={student} /></TabsContent>
        </div>
        <aside className={styles.aside} aria-label="Swimmer at a glance">
          <section><h2>Current enrolment{current.length === 1 ? "" : "s"}</h2>{current.length ? current.map(e => <div key={e.id} className="mt-3 space-y-1"><p className="font-semibold">{e.level.name}</p><p>{formatSlotShort(e.course)}</p>{e.course.instructor ? <p className="flex items-start gap-2"><UserRound aria-hidden="true" />{e.course.instructor.name}</p> : null}<p className="flex items-start gap-2"><MapPin aria-hidden="true" />{e.course.club.name}</p></div>) : <p>Not enrolled in a class.</p>}</section>
          <section><h2>Next lesson</h2>{next ? <><p className="flex items-start gap-2"><CalendarDays aria-hidden="true" />{formatDate(parseDateOnly(next.date))} · {formatTime(next.enrolment.course.startMinutes)}</p><p>{courseName(next.enrolment.course)} · {next.enrolment.course.club.name}</p></> : <p>No upcoming weekly class.</p>}</section>
          <section><h2>Contact</h2><p>{student.contactName ?? "No contact recorded"}</p>{student.contactPhone ? <a href={`tel:${student.contactPhone.replace(/\s/g, "")}`} className="inline-flex min-h-11 items-center underline underline-offset-4">{student.contactPhone}</a> : null}<Button variant="ghost" className="mt-1" onClick={() => navigate("details")}>View contacts</Button></section>
          <section><h2>Medical notes</h2><p className="whitespace-pre-wrap">{student.medicalNotes || "None recorded"}</p></section>
          <p className="flex gap-2"><Info aria-hidden="true" />History includes both sites.</p>
        </aside>
      </div>
    </Tabs>
  </article>;
}

function ProfileDetails({ student }: { student: StudentDetail }) {
  const tel = (value: string) => <a className="inline-flex min-h-11 items-center underline" href={`tel:${value.replace(/\s/g, "")}`}>{value}</a>;
  const fields: [string, React.ReactNode][] = [["Member number", student.memberNumber], ["Date of birth", student.dateOfBirth ? formatDate(student.dateOfBirth) : null], ["Joined", formatDate(student.joinedOn)], ["Home facility", student.club.name], ["Contact", student.contactName], ["Phone", student.contactPhone ? tel(student.contactPhone) : null], ["Email", student.contactEmail ? <a key="email" href={`mailto:${student.contactEmail}`} className="break-all underline">{student.contactEmail}</a> : null], ["Emergency contact", [student.emergencyName, student.emergencyRelationship].filter(Boolean).join(" · ")], ["Emergency phone", student.emergencyPhone ? tel(student.emergencyPhone) : null], ["Medical notes", student.medicalNotes], ["Other notes", student.notes], ["Photo consent", student.photoConsent ? `Given${student.photoConsentOn ? ` on ${formatDate(student.photoConsentOn)}` : ""}` : "Not given"]];
  return <section><h2 className="mb-5 text-xl font-semibold">Details and contacts</h2><dl className="divide-y divide-ui-border">{fields.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-ui-muted-foreground">{label}</dt><dd className="min-w-0 whitespace-pre-wrap text-sm">{value || "Not recorded"}</dd></div>)}</dl></section>;
}
