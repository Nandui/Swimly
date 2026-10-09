"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Flag, Phone, TriangleAlert, Waves } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Progress } from "@/components/shadcn/progress";
import { Tag } from "@/components/ui-kit/tag";
import { BackLink } from "@/components/ui-kit/back-link";
import { Notice } from "@/components/ui-kit/notice";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { SearchField } from "@/components/ui-kit/search-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import type { StudentDetail } from "@/modules/activities/features/students/server/data/students";
import type { StudentEnrolment, TransferTarget } from "@/modules/activities/shared/enrolment/data/enrolments";
import type { ProgrammeProgress } from "@/modules/activities/shared/progression/data/progress";
import type { StudentAssessment } from "@/modules/activities/shared/assessments/data/assessments";
import { BOOKING_STATUS_META } from "@/modules/activities/shared/assessments/constants";
import { ENROLMENT_STATUS_META } from "@/modules/activities/shared/enrolment/constants";
import { ageInYears, formatDate, parseDateOnly, toDateOnlyString } from "@/lib/format";
import { formatSlotShort, formatTime } from "@/modules/activities/shared/courses/constants";
import { fullName, STUDENT_STATUS_META } from "@/modules/activities/shared/students/constants";
import { swimmerProfileHref } from "@/modules/activities/features/students/server/directory";
import { chapterOrder, HISTORY_KINDS, HISTORY_META, nextLesson, type HistoryKind, type HistoryPage } from "@/modules/activities/features/students/server/history";
import { AddSwimmer } from "@/modules/activities/features/students/components/add-swimmer";
import { FollowUpHistory } from "@/modules/activities/shared/enrolment/components/follow-up-history";
import { ManageProfileEnrolments } from "@/modules/activities/features/students/components/profile-enrolments";
import { ProfileCompetencies } from "@/modules/activities/features/students/components/profile-competencies";
import { HistoryFeed } from "@/modules/activities/features/students/components/profile-history";
import { GuardianAccessPanel } from "@/modules/activities/shared/parents/components/guardian-access";
import styles from "@/modules/activities/features/students/components/swimmer-profile.module.css";

type Tab = "journey" | "competencies" | "attendance" | "assessments" | "details" | "parents";
const JOURNEY_MODES = [{ value: "milestones", label: "Milestones" }, { value: "activity", label: "All activity" }];
export type ProfileAccess = { edit: boolean; enrol: boolean; assess: boolean; complete: boolean; override: boolean; courses: boolean; assessments: boolean; audit: boolean; parents?: boolean };
export type SwimmerProfileProps = { student: StudentDetail; enrolments: StudentEnrolment[]; programmes: ProgrammeProgress[]; assessments: StudentAssessment[]; targets: TransferTarget[]; history: HistoryPage; access: ProfileAccess; initialTab?: string; returnTo: string; instant: string };
function profileTab(value?: string, parents = false): Tab {
  if (value === "progress") return "competencies";
  if (value === "parents" && parents) return "parents";
  return ["competencies", "attendance", "assessments", "details"].includes(value ?? "") ? value as Tab : "journey";
}

export function SwimmerProfile({ student, enrolments, programmes, assessments, targets, history, access, initialTab, returnTo, instant }: SwimmerProfileProps) {
  const [tab, setTab] = useState<Tab>(profileTab(initialTab, access.parents)), [mode, setMode] = useState("milestones");
  const [programme, setProgramme] = useState("all"), [kind, setKind] = useState<HistoryKind>("all");
  const [search, setSearch] = useState(""), [level, setLevel] = useState<string | null>(null);
  const router = useRouter(), name = fullName(student);
  const chapters = chapterOrder(enrolments).filter(e => programme === "all" || e.programmeId === programme);
  const current = enrolments.filter(e => e.status === "ACTIVE");
  const next = nextLesson(enrolments, new Date(instant));
  const programmeOptions = [...new Map([...enrolments.map(e => [e.programmeId, e.programme.name] as const), ...programmes.map(p => [p.programmeId, p.programmeName] as const)]).entries()];
  function navigate(next: Tab) { setTab(next); router.replace(swimmerProfileHref(student.id, returnTo, next), { scroll: false }); }
  function showCompetencies(id: string) { setLevel(id); navigate("competencies"); }
  return <article className={styles.profile} data-swimmer-profile>
    <header className={styles.header}>
      <div className="min-w-0 flex flex-col gap-1"><BackLink href={returnTo} label="Swimmers" /><div className={styles.identity}><Avatar size="xl" aria-hidden="true"><AvatarFallback>{student.firstName.slice(0, 1)}{student.lastName.slice(0, 1)}</AvatarFallback></Avatar><div className="min-w-0"><h1 className="[overflow-wrap:anywhere]">{name}</h1><p className="mt-2 text-sm text-ui-muted-foreground">{student.dateOfBirth ? `Age ${ageInYears(student.dateOfBirth, new Date(instant))} · ` : ""}{student.memberNumber ? `Member ${student.memberNumber} · ` : ""}Joined {formatDate(student.joinedOn)}</p>{student.status !== "ACTIVE" ? <Tag meta={STUDENT_STATUS_META[student.status]} /> : null}</div></div></div>
      <div className="flex flex-wrap gap-2"><FollowUpHistory studentId={student.id} name={fullName(student)} canRecord={access.enrol} />{access.edit ? <AddSwimmer student={student} /> : null}{access.enrol ? <ManageProfileEnrolments studentId={student.id} active={student.status === "ACTIVE"} enrolments={enrolments} targets={targets} /> : null}</div>
    </header>
    {student.medicalNotes ? <Notice tone="error" icon={TriangleAlert} title="Medical notes: read before swimming"><p className="whitespace-pre-wrap">{student.medicalNotes}</p></Notice> : student.hasMedicalNotes ? <Notice title="Medical notes on file" description="Reception, swim school managers and the instructors teaching this swimmer can read them." /> : null}
    <Tabs value={tab} onValueChange={value => navigate(value as Tab)} className="gap-0">
      <TabsList aria-label="Swimmer profile sections"><TabsTrigger value="journey">Journey</TabsTrigger><TabsTrigger value="competencies">Competencies</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="assessments">Assessments</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger>{access.parents ? <TabsTrigger value="parents">Parent access</TabsTrigger> : null}</TabsList>
      <div className={styles.body}>
        {/* First in reading order, so phones see it before the chapters; wide screens place it on the right. */}
        <aside className={`pc-panel ${styles.glance}`} aria-labelledby="glance-heading">
          <h2 id="glance-heading">Swimmer at a glance</h2>
          <ul className="pc-rows">
            {(current.length ? current : [null]).map(e => <li key={e?.id ?? "none"} className="pc-row"><span className="pc-tile-icon"><Waves aria-hidden="true" /></span><div className="pc-row-body"><p className="pc-row-title">{e ? e.level.name : "Not in a class"}</p><p className="pc-row-hint">{e ? ["Current class", formatSlotShort(e.course), e.course.instructor?.name].filter(Boolean).join(" · ") : "Current class"}</p></div></li>)}
            <li className="pc-row"><span className="pc-tile-icon"><CalendarDays aria-hidden="true" /></span><div className="pc-row-body"><p className="pc-row-title tabular-nums">{next ? `${formatDate(parseDateOnly(next.date))}, ${formatTime(next.enrolment.course.startMinutes)}` : "No upcoming class"}</p><p className="pc-row-hint">{next ? `Next lesson · ${next.enrolment.course.club.name}` : "Next lesson"}</p></div></li>
            <li><a href={swimmerProfileHref(student.id, returnTo, "details")} className="pc-row" onClick={event => { event.preventDefault(); navigate("details"); }}><span className="pc-tile-icon"><Phone aria-hidden="true" /></span><span className="pc-row-body"><span className="pc-row-title">{student.contactName ?? "No contact recorded"}</span><span className="pc-row-hint tabular-nums">{student.contactPhone ? `Contact · ${student.contactPhone}` : "Contact details"}</span></span><ChevronRight className="pc-row-chevron" aria-hidden="true" /></a></li>
          </ul>
        </aside>
        <div className={styles.main}>
          <TabsContent value="journey" className="m-0">
            <section className="pc-panel" aria-labelledby="journey-heading">
              <div className="pc-panel-head"><h2 id="journey-heading">Every chapter, from their first swim</h2>
                <div className="flex flex-wrap items-center gap-2"><SegmentedChoice aria-label="Journey display" value={mode} onValueChange={setMode} options={JOURNEY_MODES} />{programmeOptions.length > 1 ? <Select value={programme} onValueChange={setProgramme}><SelectTrigger aria-label="Filter by programme"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All programmes</SelectItem>{programmeOptions.map(([id, label]) => <SelectItem value={id} key={id}>{label}</SelectItem>)}</SelectContent></Select> : null}</div>
              </div>
              {mode === "milestones" ? <ol className={styles.chapters} aria-label="Chapters">
                {chapters.map(e => {
                  const progress = programmes.find(p => p.programmeId === e.programmeId)?.levels.find(l => l.id === e.levelId);
                  const achieved = progress ? progress.completionSnapshot?.achieved ?? progress.achieved : 0;
                  const total = progress ? progress.completionSnapshot?.total ?? progress.total : 0;
                  const ends = e.endedOn ? formatDate(e.endedOn) : e.status === "ACTIVE" || e.status === "WAITLISTED" ? "now" : "end date not recorded";
                  return <li key={e.id}>
                    <Collapsible defaultOpen={e.id === chapters[0]?.id} className={styles.chapter} data-current={e.status === "ACTIVE"}>
                      <CollapsibleTrigger className={styles.chapterTrigger}>
                        <span className="min-w-0 flex-1">
                          <span className="pc-row-hint block tabular-nums">{formatDate(e.startedOn)} to {ends}</span>
                          <span className="block font-semibold">{e.level.name} · {e.course.club.name}</span>
                          <span className="pc-row-hint block">{formatSlotShort(e.course)}{e.course.instructor ? ` · ${e.course.instructor.name}` : ""}</span>
                        </span>
                        <Tag meta={ENROLMENT_STATUS_META[e.status]} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className={styles.chapterContent}>
                        {progress ? <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><p className="font-semibold">{progress.completionSnapshot ? `${achieved} of ${total} achieved at completion` : `${achieved} of ${total} competencies achieved${e.status === "ACTIVE" ? "" : " · current record"}`}</p><Button variant="ghost" onClick={() => showCompetencies(e.levelId)}>View competencies<ChevronRight aria-hidden="true" /></Button></div>
                          {total > 0 ? <Progress value={100 * achieved / total} aria-valuetext={`${achieved} of ${total} achieved`} aria-label={`${e.level.name} competencies achieved`} /> : null}
                          {progress.completedOn ? <p className="pc-row-hint">Completed {formatDate(progress.completedOn)}{progress.confirmedByName ? ` · ${progress.confirmedByName}` : ""}</p> : null}
                        </div> : null}
                        {e.placementReason ? <p className="text-sm">Placement reason: {e.placementReason}</p> : null}
                        {e.scheduledEndOn ? <p className="text-sm">Enrolment ends {formatDate(e.scheduledEndOn)}</p> : null}
                        <h3 className="text-sm font-semibold">Activity in this class</h3>
                        <HistoryFeed studentId={student.id} query={{ courseId: e.course.id, from: toDateOnlyString(e.startedOn), ...(e.endedOn ? { to: toDateOnlyString(e.endedOn) } : {}) }} compact footer={access.courses ? <Button asChild variant="ghost"><a href={`/courses/${e.course.id}`}>Open class</a></Button> : null} />
                      </CollapsibleContent>
                    </Collapsible>
                  </li>;
                })}
                {!chapters.length ? <li><EmptyState compact title={enrolments.length ? "No enrolments in this programme" : "No class enrolments yet"} hint={enrolments.length ? undefined : "Assessments and other records are in All activity."} /></li> : null}
                <li className="pc-row"><span className="pc-tile-icon"><Flag aria-hidden="true" /></span><div className="pc-row-body"><p className="pc-row-title">Joined the swim school</p><p className="pc-row-hint">{formatDate(student.joinedOn)}</p></div>{assessments.length ? <div className="pc-row-trail"><Button variant="ghost" onClick={() => navigate("assessments")}>Assessments and placements</Button></div> : null}</li>
              </ol> : <div className="flex flex-col gap-3">
                <form onSubmit={event => { event.preventDefault(); setSearch(String(new FormData(event.currentTarget).get("q") ?? "").trim()); }} className="flex flex-wrap items-end gap-2">
                  <SearchField label="Search activity" labelHidden name="q" defaultValue={search} placeholder="Mark, class or note" className="min-w-40 flex-1" />
                  <Select value={kind} onValueChange={value => setKind(value as HistoryKind)}><SelectTrigger aria-label="Activity type"><SelectValue /></SelectTrigger><SelectContent>{HISTORY_KINDS.map(value => <SelectItem value={value} key={value}>{HISTORY_META[value].label}</SelectItem>)}</SelectContent></Select>
                </form>
                <p className="pc-row-hint">Earlier records may contain only the latest mark or a summary. Detailed changes are kept from 12 September 2026.</p>
                <HistoryFeed studentId={student.id} initial={kind === "all" && programme === "all" && !search ? history : undefined} query={{ kind, ...(programme !== "all" ? { programmeId: programme } : {}), q: search }} />
              </div>}
            </section>
          </TabsContent>
          <TabsContent value="competencies" forceMount hidden={tab !== "competencies"} className="m-0"><ProfileCompetencies studentId={student.id} programmes={programmes} access={access} selectedLevel={level} /></TabsContent>
          <TabsContent value="attendance" className="m-0"><section className="pc-panel" aria-labelledby="attendance-heading"><div><h2 id="attendance-heading">Attendance history</h2><p className="pc-row-hint">Lesson dates, saved marks and corrections across every site.</p></div><HistoryFeed studentId={student.id} query={{ kind: "attendance" }} /></section></TabsContent>
          <TabsContent value="assessments" className="m-0"><section className="pc-panel" aria-labelledby="assessments-heading"><h2 id="assessments-heading">Assessments and placements</h2>
            {assessments.length ? <>
              <ul className="pc-rows">{assessments.map(a => <li key={a.id} className="pc-row"><div className="pc-row-body"><h3 className="pc-row-title">{a.session.type?.name ?? "Assessment session"}</h3><p className="pc-row-hint tabular-nums">{formatDate(a.session.date)} · {formatTime(a.session.startMinutes)} · {a.session.club.name}</p><p className="text-sm">{a.session.programme.name}{a.outcomeLevel ? ` · Placed at ${a.outcomeLevel.name}` : ""}</p>{a.assessedByName ? <p className="pc-row-hint">{a.assessedByName}{a.assessedOn ? ` · ${formatDate(a.assessedOn)}` : ""}</p> : null}{a.outcomeNote ? <p className="text-sm">{a.outcomeNote}</p> : null}{a.session.cancelledAt ? <p className="text-sm">Session cancelled</p> : null}</div><div className="pc-row-trail"><Tag meta={BOOKING_STATUS_META[a.status]} />{access.assessments ? <Button variant="ghost" asChild><a href={`/assessments/${a.session.id}`}>Open assessment</a></Button> : null}</div></li>)}</ul>
              <HistoryFeed studentId={student.id} query={{ kind: "assessment" }} emptyTitle="No other assessment activity" />
            </> : <HistoryFeed studentId={student.id} query={{ kind: "assessment" }} emptyTitle="No assessments yet" />}
          </section></TabsContent>
          <TabsContent value="details" className="m-0"><ProfileDetails student={student} /></TabsContent>
          {access.parents ? <TabsContent value="parents" className="m-0"><div className="pc-panel"><GuardianAccessPanel studentId={student.id} swimmerName={name} /></div></TabsContent> : null}
        </div>
      </div>
    </Tabs>
  </article>;
}

function ProfileDetails({ student }: { student: StudentDetail }) {
  // Inline links in a 44px row: the row carries the height, so every field row is even.
  const link = "font-semibold text-ui-brand-ink underline-offset-4 hover:underline";
  const tel = (value: string) => <a className={`${link} tabular-nums`} href={`tel:${value.replace(/\s/g, "")}`}>{value}</a>;
  const medical = student.medicalNotes || (student.hasMedicalNotes ? "On file. Reception, swim school managers and this swimmer's instructors can read them." : null);
  const fields: [string, React.ReactNode][] = [["Member number", student.memberNumber], ["Date of birth", student.dateOfBirth ? formatDate(student.dateOfBirth) : null], ["Joined", formatDate(student.joinedOn)], ["Home site", student.club.name], ["Contact", student.contactName], ["Phone", student.contactPhone ? tel(student.contactPhone) : null], ["Email", student.contactEmail ? <a key="email" href={`mailto:${student.contactEmail}`} className={`${link} break-all`}>{student.contactEmail}</a> : null], ["Emergency contact", [student.emergencyName, student.emergencyRelationship].filter(Boolean).join(" · ")], ["Emergency phone", student.emergencyPhone ? tel(student.emergencyPhone) : null], ["Medical notes", medical], ["Other notes", student.notes], ["Photo consent", student.photoConsent ? `Given${student.photoConsentOn ? ` on ${formatDate(student.photoConsentOn)}` : ""}` : "Not given"]];
  return <section className="pc-panel" aria-labelledby="details-heading"><h2 id="details-heading">Details and contacts</h2><dl className={`pc-rows ${styles.details}`}>{fields.map(([label, value]) => <div key={label} className="pc-row"><dt className="pc-row-hint">{label}</dt><dd className="whitespace-pre-wrap">{value || "Not recorded"}</dd></div>)}</dl></section>;
}
