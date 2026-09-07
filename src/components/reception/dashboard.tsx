"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Grid } from "@astryxdesign/core/Grid";
import { List, ListItem } from "@astryxdesign/core/List";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EndEnrolment, EnrolInCourseForStudent, PromoteFromWaitlist, TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { StudentSearch } from "@/components/students/student-search";
import { AddStudent } from "@/components/students/student-actions";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { Tag } from "@/components/ui-kit/tag";
import { courseLabel, courseName, formatSlotShort, formatTime } from "@/lib/courses/constants";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import type { ReceptionSwimmer } from "@/lib/reception/data";
import { groupReceptionClasses, receptionAvailability, receptionTimeStatus, RECEPTION_TIME_META, receptionHref, type ReceptionClass, type ReceptionGrouping } from "@/lib/reception/timetable";
import { ageLabel, fullName, STUDENT_STATUS_META } from "@/lib/students/constants";
import { formatDate } from "@/lib/format";

export type ReceptionDashboardProps = {
  clubName: string;
  dateLabel: string;
  now: number;
  courses: ReceptionClass[];
  student: ReceptionSwimmer | null;
  targets: TransferTarget[];
  group: ReceptionGrouping;
  unavailable: boolean;
  access: { manage: boolean; manageStudents: boolean; students: boolean; courses: boolean; together: boolean; assessments: boolean };
};

/** Independent desk tasks form the bento grid. The selected swimmer stays in
 *  the URL so refreshes after a save re-read their places from the database. */
export function ReceptionDashboard({ clubName, dateLabel, now, courses, student, targets, group, unavailable, access }: ReceptionDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, refreshTransition] = useTransition();
  const [timeWindow, setTimeWindow] = useState("all");
  // Keep a shift-long dashboard current without disturbing an open form or a
  // typed lookup. The server remains authoritative for local date and time.
  useEffect(() => {
    function refreshIfIdle() {
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]") || document.activeElement?.matches("input,textarea,[role=combobox]")) return;
      refreshTransition(() => router.refresh());
    }
    const timer = window.setInterval(refreshIfIdle, 60_000);
    window.addEventListener("focus", refreshIfIdle);
    document.addEventListener("visibilitychange", refreshIfIdle);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshIfIdle); document.removeEventListener("visibilitychange", refreshIfIdle); };
  }, [router]);
  function jumpTo(id: string) {
    const heading = document.getElementById(id);
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  }
  const onNow = courses.filter(course => course.startMinutes <= now && course.startMinutes + course.durationMinutes > now);
  const nextTime = courses.filter(course => course.startMinutes > now).reduce<number | null>(
    (first, course) => first === null ? course.startMinutes : Math.min(first, course.startMinutes), null
  );
  const visibleCourses = timeWindow === "all" ? courses : courses.filter(course =>
    ["running", "next"].includes(receptionTimeStatus(course, now, nextTime)));
  const sections = groupReceptionClasses(visibleCourses, group);
  const mayEnrol = access.manage && student?.status === "ACTIVE";
  const bookingLinks = [
    { visible: access.students, href: "/students", label: "Browse swimmers" },
    { visible: access.courses, href: "/courses?day=any", label: "Find a class" },
    { visible: access.together, href: "/together", label: "Sibling times" },
    { visible: access.assessments, href: "/assessments", label: "Assessments" },
  ].filter(link => link.visible);

  return (
    <VStack gap={5}>
      <PageHeader title="Reception" description={`${clubName} · ${dateLabel}`} />
      <HStack as="nav" aria-label="Reception sections" gap={2} paddingBlock={2} className="sticky top-0 z-10 bg-surface">
        <Button label="Swimmer" variant="secondary" onClick={() => jumpTo(student ? "reception-swimmer" : "reception-lookup")} />
        <Button label="Today" variant="secondary" onClick={() => jumpTo("reception-timetable")} />
        <Button label="Quick links" variant="secondary" onClick={() => jumpTo("reception-shortcuts")} />
      </HStack>
      {/* Four independent desk cards. Each grid becomes one column when two
          440px regions cannot fit; lookup and shortcuts precede the workspace.
          Low elevation separates flow cards from the background. Overlay
          components retain Astryx's own higher elevation. */}
      <Grid columns={{ minWidth: 440, max: 2 }} gap={5} align="stretch">
        <VStack as="section" aria-labelledby="reception-lookup" className="min-w-0">
          <Card padding={5} elevation="low" height="100%">
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2} id="reception-lookup" tabIndex={-1} className="scroll-mt-20">Find a swimmer</Heading>
                <Text as="p" color="secondary">Search this club by name or member number.</Text>
              </VStack>
              <StudentSearch
                key={student?.id ?? "search"}
                label="Swimmer name or member number"
                selected={student}
                includeInactive
                onSelect={hit => startTransition(() => router.push(receptionHref(hit?.id, group), { scroll: false }))}
                emptyText="No swimmers match in this club. Try their member number."
              />
            </VStack>
          </Card>
        </VStack>
        <VStack as="section" aria-labelledby="reception-shortcuts" className="min-w-0">
          <Card padding={5} elevation="low" height="100%">
            <VStack gap={3}>
              <Heading level={2} id="reception-shortcuts" tabIndex={-1} className="scroll-mt-20">Quick links</Heading>
              <Grid columns={{ minWidth: 180, max: 2 }} gap={2}>
                {access.manageStudents ? (
                  <AddStudent trigger={
                    <Button label="Add a new swimmer" variant="secondary" width="100%" className="min-h-11"
                      icon={<Icon icon={Plus} size="sm" />} />
                  } />
                ) : null}
                {bookingLinks.map(link => (
                  <Button key={link.href} href={link.href} label={link.label}
                    variant="secondary" width="100%" className="min-h-11"
                    endContent={<Icon icon="chevronRight" size="sm" />} />
                ))}
              </Grid>
              {!access.manageStudents && !bookingLinks.length ? <Text as="p" color="secondary">Use swimmer lookup to see current places. More booking screens can be enabled for your role.</Text> : null}
            </VStack>
          </Card>
        </VStack>
      </Grid>
      <Grid columns={{ minWidth: 440, max: 2 }} gap={5} align="start">
        <VStack as="section" aria-labelledby="reception-swimmer" className="min-w-0">
          <Card padding={5} elevation="low">
            <VStack gap={4}>
              <Heading level={2} id="reception-swimmer" tabIndex={-1} className="scroll-mt-20">Swimmer details</Heading>
              {pending ? <Text as="p" role="status">Loading swimmer…</Text> : (
                <>
                  {unavailable ? <Banner status="warning" title="Swimmer unavailable in this club. Search again or check the selected club." collapsible={false} /> : null}
                  {student ? (
                    <VStack gap={4}>
                      <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                        <VStack gap={1}>
                          <Heading level={3}>{fullName(student)}</Heading>
                          <Text color="secondary">{student.memberNumber ?? "No member number recorded"}</Text>
                          <Text color="secondary">{student.dateOfBirth ? `Age ${ageLabel(student.dateOfBirth)}` : "Date of birth not recorded"}</Text>
                        </VStack>
                        <Tag color={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Tag>
                      </HStack>
                      <HStack gap={2} wrap="wrap" vAlign="center">
                        {access.students ? <Button href={`/students/${student.id}`} label="Open swimmer profile" variant="secondary" /> : null}
                        {mayEnrol ? <EnrolInCourseForStudent student={student} courses={targets} /> : null}
                      </HStack>
                      {student.status === "INACTIVE" ? <Banner status="info" title="This swimmer is inactive. They must be made active before enrolling or moving them." collapsible={false} /> : null}
                      <VStack gap={1} as="section" aria-label="Contact details">
                        <Text weight="semibold">Contact</Text>
                        <Text>{student.contactName || "No contact name recorded"}</Text>
                        <HStack gap={3} wrap="wrap" vAlign="center">
                          {student.contactPhone ? <Link href={`tel:${student.contactPhone.replace(/\s+/g, "")}`} className="min-h-11 inline-flex items-center">{student.contactPhone}</Link> : <Text color="secondary">No phone number recorded</Text>}
                          {student.contactEmail ? <Link href={`mailto:${student.contactEmail}`} className="min-h-11 inline-flex items-center break-all">{student.contactEmail}</Link> : null}
                        </HStack>
                      </VStack>
                      <Divider />
                      <Heading level={3}>Classes and waitlist</Heading>
                      {student.enrolments.length === 0 ? (
                        <Text as="p" color="secondary">No current class or waitlist place.</Text>
                      ) : student.enrolments.map(enrolment => {
                        const label = courseLabel(enrolment.course);
                        const status = ENROLMENT_STATUS_META[enrolment.status];
                        const coverName = courses.find(course => course.id === enrolment.course.id)?.coverName;
                        return (
                          <VStack key={enrolment.id} gap={2} as="section" aria-label={`${label}, ${status.label}`}>
                            <HStack gap={2} wrap="wrap" vAlign="center">
                              <Heading level={4}>{courseName(enrolment.course)}</Heading>
                              <Tag color={status.color}>{status.label}</Tag>
                            </HStack>
                            <Text weight="semibold" hasTabularNumbers>
                              {formatSlotShort(enrolment.course)}–{formatTime(enrolment.course.startMinutes + enrolment.course.durationMinutes)}
                            </Text>
                            <Text as="p" color="secondary">
                              {[enrolment.level.name, enrolment.course.location ?? "Location not recorded", coverName ? `${coverName} (cover today)` : enrolment.course.instructor?.name ?? "Instructor not assigned"].join(" · ")}
                            </Text>
                            {enrolment.course.archivedAt ? <Text as="p" color="secondary">This class is archived.</Text> : null}
                            {enrolment.scheduledEndOn ? <Text as="p" color="secondary">Unenrols {formatDate(enrolment.scheduledEndOn)}</Text> : null}
                            <HStack gap={2} wrap="wrap" vAlign="center">
                              {mayEnrol && enrolment.status === "WAITLISTED" && !enrolment.course.archivedAt ? <PromoteFromWaitlist variant="button" classLabel={label} enrolment={{ ...enrolment, student }} /> : null}
                              {mayEnrol ? <TransferEnrolment variant="button" classLabel={label} enrolment={{ ...enrolment, student }} targets={targets.filter(target => target.id !== enrolment.course.id)} /> : null}
                              {access.manage ? <EndEnrolment variant="button" enrolment={{ ...enrolment, student }} classLabel={label} /> : null}
                              {access.courses ? <Button href={`/courses/${enrolment.course.id}`} label="Class details" aria-label={`Class details for ${label}`} variant="ghost" /> : null}
                            </HStack>
                          </VStack>
                        );
                      })}
                      {!access.manage ? <Text as="p" color="secondary">You can look up classes here. Moving or unenrolling a swimmer needs the enrolment permission.</Text> : null}
                    </VStack>
                  ) : (
                    <VStack gap={2} paddingBlock={2}>
                      <Text weight="semibold">No swimmer selected</Text>
                      <Text as="p" color="secondary">Choose a swimmer above to see their contacts, classes and enrolment actions.</Text>
                    </VStack>
                  )}
                </>
              )}
            </VStack>
          </Card>
        </VStack>

        <VStack as="section" aria-labelledby="reception-timetable" className="min-w-0">
          <Card padding={5} elevation="low">
            <VStack gap={5}>
              <VStack gap={3}>
                <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                  <Heading level={2} id="reception-timetable" tabIndex={-1} className="scroll-mt-20">Today’s classes</Heading>
                  <Button label="Refresh" variant="ghost" isLoading={refreshing} onClick={() => refreshTransition(() => router.refresh())} />
                </HStack>
                <VStack gap={1}>
                  <Text as="p" hasTabularNumbers>{courses.length} classes today · {onNow.length} running now</Text>
                  <Text as="p" color="secondary">{nextTime !== null ? `Next start: ${formatTime(nextTime)}` : courses.length ? "No more classes start today." : "No classes are timetabled today."}</Text>
                </VStack>
                <SegmentedControl label="Show classes" value={timeWindow} onChange={setTimeWindow}>
                  <SegmentedControlItem value="all" label="All day" />
                  <SegmentedControlItem value="current" label="Now and next" />
                </SegmentedControl>
                <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                  <LinkSegments label="Group today's classes" value={group} options={[
                    { value: "time", label: "By time", href: receptionHref(student?.id, "time") },
                    { value: "level", label: "By level", href: receptionHref(student?.id, "level") },
                  ]} />
                  <Text type="supporting">As of {formatTime(now)}</Text>
                </HStack>
              </VStack>
              {sections.length === 0 ? <Text as="p" color="secondary">{courses.length ? "No classes are running or due to start. Choose All day to see earlier classes." : "Nothing is timetabled today. You can still look up swimmers and manage their places."}</Text> : (
                <VStack gap={6}>
                  {sections.map(section => (
                    <List key={section.key} hasDividers header={
                      <VStack gap={1}>
                        <Heading level={3}>{section.title}</Heading>
                        {section.description ? <Text type="supporting">{section.description}</Text> : null}
                      </VStack>
                    }>
                      {section.courses.map(course => (
                        <ListItem key={course.id} label={<HStack gap={2} wrap="wrap" vAlign="center"><Text weight="semibold">{courseName(course)}</Text><Tag color={RECEPTION_TIME_META[receptionTimeStatus(course, now, nextTime)].color}>{RECEPTION_TIME_META[receptionTimeStatus(course, now, nextTime)].label}</Tag></HStack>} description={
                          <VStack gap={2} className="min-w-0 break-words">
                            <Text hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)} · {course.level.name}</Text>
                            <Text as="p" color="secondary">{course.location ?? "Location not recorded"} · {course.coverName ? `${course.coverName} (cover)` : course.instructor?.name ?? "Instructor not assigned"}</Text>
                            <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
                              <Text color="secondary">{receptionAvailability(course._count.enrolments, course.capacity)}</Text>
                              {access.courses ? <Button href={`/courses/${course.id}`} label="Class details" aria-label={`Class details for ${courseLabel(course)}`} variant="ghost" size="md" /> : null}
                            </HStack>
                          </VStack>
                        } />
                      ))}
                    </List>
                  ))}
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>
      </Grid>
    </VStack>
  );
}
