"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Plus, Users } from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EndEnrolment, PromoteFromWaitlist } from "@/components/enrolment/enrolment-actions";
import { useDialogTriggerFocus } from "@/components/form-dialog";
import { AddStudent } from "@/components/students/student-actions";
import { StudentSearch } from "@/components/students/student-search";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { Tag } from "@/components/ui-kit/tag";
import { courseLabel, courseName, DAY_META, formatSlotShort, formatTime } from "@/lib/courses/constants";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import { formatDate } from "@/lib/format";
import type { ReceptionClassOption, ReceptionSwimmer } from "@/lib/reception/data";
import { partitionReceptionClasses, receptionHref, type ReceptionClass, type ReceptionGrouping } from "@/lib/reception/timetable";
import { ageLabel, fullName, STUDENT_STATUS_META } from "@/lib/students/constants";
import { ClassFinder } from "./class-finder";
import { ReceptionTimetable } from "./timetable";

export type ReceptionDashboardProps = {
  clubName: string; dateLabel: string; now: number;
  courses: ReceptionClass[]; student: ReceptionSwimmer | null; targets: ReceptionClassOption[];
  group: ReceptionGrouping; unavailable: boolean;
  access: { manage: boolean; addSwimmers: boolean; students: boolean; courses: boolean; together: boolean; assessments: boolean };
};

/** One swimmer sheet; the shell owns the frame. An open finder survives a
 *  refresh, but resets when the swimmer or club changes. */
export function ReceptionDashboard({ clubName, dateLabel, now, courses, student, targets, group, unavailable, access }: ReceptionDashboardProps) {
  const router = useRouter();
  const [selecting, startSelection] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [showToday, setShowToday] = useState(false);
  useEffect(() => {
    function refreshIfIdle() {
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open],[data-reception-editing]") || document.activeElement?.matches("input,textarea,[role=combobox]")) return;
      startRefresh(() => router.refresh());
    }
    const timer = window.setInterval(refreshIfIdle, 60_000);
    window.addEventListener("focus", refreshIfIdle);
    document.addEventListener("visibilitychange", refreshIfIdle);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfIdle);
      document.removeEventListener("visibilitychange", refreshIfIdle);
    };
  }, [router]);
  const { running } = partitionReceptionClasses(courses, now);
  const selectSwimmer = (id?: string | null) => startSelection(() => router.push(receptionHref(id, group), { scroll: false }));

  return <VStack gap={5}>
    <PageHeader title="Reception" description={dateLabel} actions={<HStack gap={2} wrap="wrap">
      <Button label="Today’s classes" aria-expanded={showToday} onClick={() => setShowToday(value => !value)} icon={<Icon icon={CalendarDays} size="sm" />} />
      {access.addSwimmers ? <AddStudent onCreated={selectSwimmer} trigger={<Button label="Add swimmer" variant="secondary" icon={<Icon icon={Plus} size="sm" />} />} /> : null}
    </HStack>} />
    {showToday ? <Section variant="muted" padding={4} aria-label="Today’s classes">
      <VStack gap={4}>
        <HStack gap={3} hAlign="between" wrap="wrap" vAlign="center">
          <Heading level={2}>Today’s classes</Heading>
          <Button label="Refresh classes" variant="ghost" isLoading={refreshing} onClick={() => startRefresh(() => router.refresh())} />
        </HStack>
        <Text color="secondary">{courses.length} classes · {running.length} running now · As of {formatTime(now)}</Text>
        <LinkSegments label="Group today's classes" value={group} options={[
          { value: "time", label: "By time", href: receptionHref(student?.id, "time") },
          { value: "level", label: "By level", href: receptionHref(student?.id, "level") },
        ]} />
        {courses.length ? <ReceptionTimetable courses={courses} group={group} now={now} canOpen={access.courses} /> : <EmptyState isCompact title="No classes timetabled today" description={`Nothing is timetabled at ${clubName} today. You can still manage swimmers and their places.`} />}
      </VStack>
    </Section> : null}
    <VStack gap={4} as="section" aria-label="Find a swimmer">
      <StudentSearch key={`search-${student?.id ?? "empty"}`} label="Find a swimmer" labelHidden hasSearchIcon placeholder="Swimmer name or member number"
        selected={student} includeInactive onSelect={hit => selectSwimmer(hit?.id)} emptyText="No swimmers match in this club. Try their member number." />
      {selecting ? <Text as="p" role="status">Loading swimmer…</Text> : unavailable ? <Banner status="warning" title="Swimmer unavailable in this club. Search again or check the selected club." collapsible={false} /> : student ? (
        <SwimmerSheet key={student.id} student={student} targets={targets} courses={courses} access={access} />
      ) : <Section variant="muted" padding={6}><EmptyState headingLevel={2} title="Find a swimmer to get started" description={`See their level and current places, then compare classes across the week.${access.addSwimmers ? " For a new swimmer, choose Add swimmer." : ""}`} /></Section>}
    </VStack>
    <QuickBooking access={access} />
  </VStack>;
}

function QuickBooking({ access }: Pick<ReceptionDashboardProps, "access">) {
  const links = [
    { visible: access.together, href: "/together", label: "Find sibling times", icon: Users },
    { visible: access.assessments, href: "/assessments", label: "Book an assessment", icon: CalendarCheck },
    { visible: access.courses, href: "/courses?day=any", label: "Browse all classes", icon: CalendarDays },
  ].filter(link => link.visible);
  if (!links.length) return null;
  return <HStack gap={2} wrap="wrap" as="nav" aria-label="Other reception tasks">
    {links.map(link => <Button key={link.href} href={link.href} label={link.label} variant="ghost" icon={<Icon icon={link.icon} size="sm" />} />)}
  </HStack>;
}

function SwimmerSheet({ student, targets, courses, access }: {
  student: ReceptionSwimmer; targets: ReceptionClassOption[]; courses: ReceptionClass[]; access: ReceptionDashboardProps["access"];
}) {
  const [finder, setFinder] = useState<string | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const rememberContactTrigger = useDialogTriggerFocus(contactsOpen);
  const finderTrigger = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mayEnrol = access.manage && student.status === "ACTIVE";
  const source = student.enrolments.find(place => place.id === finder);
  const levels = [...new Map(student.enrolments.map(place => [`${place.programme.id}:${place.level.id}`, { ...place.level, programme: place.programme }])).values()];
  function openFinder(value: string, trigger: HTMLElement) { finderTrigger.current = trigger; setFinder(value); }
  function closeFinder() {
    setFinder(null);
    requestAnimationFrame(() => (finderTrigger.current?.isConnected ? finderTrigger.current : heading.current)?.focus());
  }
  return <VStack gap={4} as="section" aria-label={`Swimmer sheet for ${fullName(student)}`}>
    <Divider />
    <HStack gap={3} hAlign="between" wrap="wrap" vAlign="start">
      <VStack gap={2} className="min-w-0">
        <HStack gap={2} wrap="wrap" vAlign="center">
          <Heading level={2} ref={heading} tabIndex={-1}>{fullName(student)}</Heading>
          <Tag color={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Tag>
          <Text color="secondary">{student.memberNumber ?? "No member number"} · {student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Date of birth not recorded"}</Text>
        </HStack>
        <Text color="secondary">{levels.length ? `Placement ${levels.length === 1 ? "level" : "levels"}: ${levels.map(level => `${level.name} · ${level.programme.name}`).join("; ")}` : "No current placement level"}</Text>
      </VStack>
      <HStack gap={2} wrap="wrap">
        <Button label="Contacts" onClick={event => { rememberContactTrigger(event.currentTarget); setContactsOpen(true); }} />
        {access.students ? <Button href={`/students/${student.id}`} label="Full profile" /> : null}
      </HStack>
    </HStack>
    {contactsOpen ? <Dialog isOpen onOpenChange={setContactsOpen} width={448}>
      <DialogHeader title={`Contacts for ${fullName(student)}`} onOpenChange={setContactsOpen} />
      <VStack gap={3} padding={4}>
        <Text weight="semibold">{student.contactName || "No contact name recorded"}</Text>
        {student.contactPhone ? <Link href={`tel:${student.contactPhone.replace(/\s+/g, "")}`} className="min-h-11 inline-flex items-center break-all">{student.contactPhone}</Link> : <Text color="secondary">No phone number recorded</Text>}
        {student.contactEmail ? <Link href={`mailto:${student.contactEmail}`} className="min-h-11 inline-flex items-center break-all">{student.contactEmail}</Link> : <Text color="secondary">No email address recorded</Text>}
        <HStack hAlign="end"><Button label="Close contacts" onClick={() => setContactsOpen(false)} /></HStack>
      </VStack>
    </Dialog> : null}
    {student.status === "INACTIVE" ? <Banner status="info" title="This swimmer is inactive. They must be made active before enrolling or moving them." collapsible={false} /> : null}
    <VStack gap={3} as="section" aria-labelledby="reception-places">
      <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
        <Heading level={3} id="reception-places">Current places</Heading>
        {mayEnrol ? <Button label="Find a place" variant={finder === "new" ? "primary" : "secondary"} aria-expanded={finder === "new"} onClick={event => openFinder("new", event.currentTarget)} icon={<Icon icon={Plus} size="sm" />} /> : null}
      </HStack>
      {student.enrolments.length ? <Table density="compact" textOverflow="wrap" className="table-fixed" aria-labelledby="reception-places">
        <TableHeader><TableRow>
          {/* Wrapped Astryx cells use max-width: 0; release it on the sized
              time/action headers so the browser honours their column widths. */}
          <TableHeaderCell className="hidden md:table-cell md:w-32 max-w-none">Day &amp; time</TableHeaderCell><TableHeaderCell>Class &amp; level</TableHeaderCell>
          <TableHeaderCell className="hidden lg:table-cell">Pool &amp; instructor</TableHeaderCell>
          <TableHeaderCell className="hidden xl:table-cell">Programme</TableHeaderCell>
          <TableHeaderCell className="w-28 md:w-40 max-w-none"><Text className="sr-only">Place actions</Text></TableHeaderCell>
        </TableRow></TableHeader>
        <TableBody>{[...student.enrolments].sort((a, b) => DAY_META[a.course.dayOfWeek].index - DAY_META[b.course.dayOfWeek].index || a.course.startMinutes - b.course.startMinutes).map(enrolment => {
          const label = courseLabel(enrolment.course);
          const status = ENROLMENT_STATUS_META[enrolment.status];
          const cover = courses.find(course => course.id === enrolment.course.id)?.coverName;
          const teacher = cover ? `${cover} (cover today)` : enrolment.course.instructor?.name ?? "Instructor not assigned";
          return <TableRow key={enrolment.id}>
            <TableCell className="hidden md:table-cell"><VStack gap={1}><Text weight="semibold">{DAY_META[enrolment.course.dayOfWeek].short}</Text><Text hasTabularNumbers>{formatTime(enrolment.course.startMinutes)}–{formatTime(enrolment.course.startMinutes + enrolment.course.durationMinutes)}</Text></VStack></TableCell>
            <TableCell><VStack gap={1} className="break-words">
              <Text weight="semibold">{courseName(enrolment.course)}</Text>
              <Text hasTabularNumbers className="md:hidden">{formatSlotShort(enrolment.course)}–{formatTime(enrolment.course.startMinutes + enrolment.course.durationMinutes)}</Text>
              <HStack gap={2} wrap="wrap" vAlign="center">{courseName(enrolment.course) !== enrolment.level.name ? <Text>{enrolment.level.name}</Text> : null}<Tag color={status.color}>{status.label}</Tag></HStack>
              {enrolment.level.id !== enrolment.course.level.id || enrolment.programme.id !== enrolment.course.level.programme.id ? <Text color="secondary">Class now teaches {enrolment.course.level.name} · {enrolment.course.level.programme.name}</Text> : null}
              <Text color="secondary" className="lg:hidden">{enrolment.course.location ?? "Location not recorded"} · {teacher}</Text>
              <Text color="secondary" className="xl:hidden">{enrolment.programme.name}</Text>
              {enrolment.course.archivedAt ? <Text color="secondary">Archived class</Text> : null}
              {enrolment.scheduledEndOn ? <Text color="secondary">Unenrols {formatDate(enrolment.scheduledEndOn)}</Text> : null}
            </VStack></TableCell>
            <TableCell className="hidden lg:table-cell"><VStack gap={1}><Text>{enrolment.course.location ?? "Location not recorded"}</Text><Text color="secondary">{teacher}</Text></VStack></TableCell>
            <TableCell className="hidden xl:table-cell">{enrolment.programme.name}</TableCell>
            <TableCell><VStack gap={2}>
              {mayEnrol ? <Button label="Move" aria-label={`Move from ${label}`} variant={finder === enrolment.id ? "primary" : "secondary"} aria-expanded={finder === enrolment.id} onClick={event => openFinder(enrolment.id, event.currentTarget)} /> : null}
              <Collapsible defaultIsOpen={false} trigger={<Text>More actions<Text className="sr-only"> for {label}</Text></Text>}>
                <VStack gap={2}>
                  {mayEnrol && enrolment.status === "WAITLISTED" && !enrolment.course.archivedAt ? <PromoteFromWaitlist variant="button" classLabel={label} enrolment={{ ...enrolment, student }} /> : null}
                  {access.manage ? <EndEnrolment variant="button" enrolment={{ ...enrolment, student }} classLabel={label} /> : null}
                  {access.courses ? <Button href={`/courses/${enrolment.course.id}`} label="Class details" aria-label={`Class details for ${label}`} variant="ghost" /> : null}
                  {!access.manage && !access.courses ? <Text color="secondary">No actions available</Text> : null}
                </VStack>
              </Collapsible>
            </VStack></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table> : <Text as="p" color="secondary">No current class or waitlist place.{mayEnrol ? " Choose Find a place to compare classes." : ""}</Text>}
      {!access.manage ? <Text as="p" color="secondary">Changing places requires the enrolment permission.</Text> : null}
    </VStack>
    {finder && mayEnrol ? source || finder === "new" ? <ClassFinder key={finder} student={student} courses={targets} source={source} onClose={closeFinder} /> : <VStack gap={2}><Banner status="info" title="That place has changed. Check the current places above before making another change." collapsible={false} /><HStack><Button label="Close finder" onClick={closeFinder} /></HStack></VStack> : null}
  </VStack>;
}
