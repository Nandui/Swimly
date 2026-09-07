"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { EndEnrolment, EnrolInCourseForStudent, TransferEnrolment } from "@/components/enrolment/enrolment-actions";
import { StudentSearch } from "@/components/students/student-search";
import { PageHeader } from "@/components/ui-kit/page-header";
import { LinkSegments } from "@/components/ui-kit/link-segments";
import { Tag } from "@/components/ui-kit/tag";
import { capacityLabel, courseLabel, courseName, formatSlotShort, formatTime } from "@/lib/courses/constants";
import type { TransferTarget } from "@/lib/enrolment/data/enrolments";
import { ENROLMENT_STATUS_META } from "@/lib/enrolment/constants";
import type { ReceptionSwimmer } from "@/lib/reception/data";
import { groupReceptionClasses, receptionHref, type ReceptionClass, type ReceptionGrouping } from "@/lib/reception/timetable";
import { fullName, STUDENT_STATUS_META } from "@/lib/students/constants";
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
  access: { manage: boolean; students: boolean; courses: boolean; together: boolean; assessments: boolean };
};

/** Independent desk tasks form the bento grid. The selected swimmer stays in
 *  the URL so refreshes after a save re-read their places from the database. */
export function ReceptionDashboard({ clubName, dateLabel, now, courses, student, targets, group, unavailable, access }: ReceptionDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sections = groupReceptionClasses(courses, group);
  const onNow = courses.filter(course => course.startMinutes <= now && course.startMinutes + course.durationMinutes > now);
  const nextTime = courses.filter(course => course.startMinutes > now).reduce<number | null>(
    (first, course) => first === null ? course.startMinutes : Math.min(first, course.startMinutes), null
  );
  const mayEnrol = access.manage && student?.status === "ACTIVE";
  const bookingLinks = [
    { visible: access.courses, href: "/courses?day=any", label: "Find a class on any day" },
    { visible: access.together, href: "/together", label: "Find a time for siblings" },
    { visible: access.assessments, href: "/assessments", label: "Open assessment bookings" },
  ].filter(link => link.visible);

  return (
    <VStack gap={5}>
      <PageHeader title="Reception" description={`${clubName} · ${dateLabel}`} />
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12">
        <section aria-labelledby="reception-lookup" className="min-w-0 xl:col-span-7 xl:row-span-2">
          <Card height="100%" padding={5}>
            <VStack gap={4}>
              <Heading level={2} id="reception-lookup">Find a swimmer</Heading>
              <Text as="p" color="secondary">Find their class, move them to another class or end a place.</Text>
              <StudentSearch
                key={student?.id ?? "search"}
                label="Swimmer name or member number"
                selected={student}
                onSelect={hit => startTransition(() => router.push(receptionHref(hit?.id, group), { scroll: false }))}
                emptyText="No active swimmers match in this club. Try their member number."
              />
              {pending ? <Text as="p" role="status">Loading swimmer…</Text> : (
                <>
                  {unavailable ? <Banner status="warning" title="Swimmer unavailable in this club. Search again or check the selected club." collapsible={false} /> : null}
                  {student ? (
                    <VStack gap={4}>
                      <Divider />
                      <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                        <VStack gap={1}>
                          <Heading level={3}>{fullName(student)}</Heading>
                          <Text color="secondary">{student.memberNumber ?? "No member number recorded"}</Text>
                        </VStack>
                        <Tag color={STUDENT_STATUS_META[student.status].color}>{STUDENT_STATUS_META[student.status].label}</Tag>
                      </HStack>
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
                              {mayEnrol ? <TransferEnrolment variant="button" classLabel={label} enrolment={{ ...enrolment, student }} targets={targets.filter(target => target.id !== enrolment.course.id)} /> : null}
                              {access.manage ? <EndEnrolment variant="button" enrolment={{ ...enrolment, student }} classLabel={label} /> : null}
                              {access.courses ? <Link className="inline-flex min-h-11 items-center" href={`/courses/${enrolment.course.id}`} isStandalone>Class details</Link> : null}
                            </HStack>
                          </VStack>
                        );
                      })}
                      <HStack gap={3} wrap="wrap" vAlign="center">
                        {mayEnrol ? <EnrolInCourseForStudent student={student} courses={targets} /> : null}
                        {access.students ? <Link className="inline-flex min-h-11 items-center" href={`/students/${student.id}`} isStandalone>Full swimmer profile</Link> : null}
                      </HStack>
                      {!access.manage ? <Text as="p" color="secondary">You can look up classes here. Moving or unenrolling a swimmer needs the enrolment permission.</Text> : null}
                    </VStack>
                  ) : (
                    <VStack gap={2} paddingBlock={5}>
                      <Text type="large" weight="semibold">Their class, at a glance</Text>
                      <Text as="p" color="secondary">Choose a swimmer to see their level, class time, instructor and location. Each place has its own actions.</Text>
                      {access.students ? <Link className="inline-flex min-h-11 items-center" href="/students" isStandalone>Browse all swimmers, including inactive swimmers</Link> : null}
                    </VStack>
                  )}
                </>
              )}
            </VStack>
          </Card>
        </section>

        <section aria-labelledby="reception-summary" className="min-w-0 xl:col-span-5">
          <Card height="100%" padding={5}>
            <VStack gap={4}>
              <Heading level={2} id="reception-summary">Today at a glance</Heading>
              <div className="grid grid-cols-2 gap-4">
                <VStack gap={1}><Text type="display-3" hasTabularNumbers>{courses.length}</Text><Text color="secondary">Classes today</Text></VStack>
                <VStack gap={1}><Text type="display-3" hasTabularNumbers>{onNow.length}</Text><Text color="secondary">Running now</Text></VStack>
              </div>
              <Text as="p">{nextTime !== null ? `Next start: ${formatTime(nextTime)}` : courses.length ? "No more classes start today." : "No classes are timetabled today."}</Text>
              <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
                <Text type="supporting">As of {formatTime(now)}</Text>
                <Button label="Refresh" variant="ghost" isLoading={pending} onClick={() => startTransition(() => router.refresh())} />
              </HStack>
            </VStack>
          </Card>
        </section>

        <section aria-labelledby="reception-shortcuts" className="min-w-0 xl:col-span-5">
          <Card height="100%" padding={5}>
            <VStack gap={2}>
              <Heading level={2} id="reception-shortcuts">Quick Links</Heading>
              {bookingLinks.map(link => (
                <Button key={link.href} href={link.href} label={link.label}
                  variant="secondary" width="100%" className="min-h-11"
                  endContent={<Icon icon="chevronRight" size="sm" />} />
              ))}
              {!access.courses && !access.together && !access.assessments ? <Text as="p" color="secondary">Use swimmer lookup to see current places. More booking screens can be enabled for your role.</Text> : null}
            </VStack>
          </Card>
        </section>

        <section aria-labelledby="reception-timetable" className="min-w-0 xl:col-span-12">
          <Card padding={5}>
            <VStack gap={5}>
              <HStack gap={3} wrap="wrap" hAlign="between" vAlign="center">
                <Heading level={2} id="reception-timetable">Today’s classes</Heading>
                <LinkSegments label="Group today's classes" value={group} options={[
                  { value: "time", label: "By time", href: receptionHref(student?.id, "time") },
                  { value: "level", label: "By level", href: receptionHref(student?.id, "level") },
                ]} />
              </HStack>
              {sections.length === 0 ? <Text as="p" color="secondary">Nothing is timetabled today. You can still look up swimmers and manage their places.</Text> : (
                <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-2">
                  {sections.map(section => (
                    <VStack gap={3} key={section.key} as="section" aria-label={section.title} className="min-w-0">
                      <VStack gap={1}>
                        <Heading level={3}>{section.title}</Heading>
                        {section.description ? <Text type="supporting">{section.description}</Text> : null}
                      </VStack>
                      <Divider />
                      {section.courses.map(course => (
                        <VStack key={course.id} gap={1}>
                          <Heading level={4}>{courseName(course)}</Heading>
                          <Text hasTabularNumbers>{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)} · {course.level.name}</Text>
                          <Text as="p" color="secondary">{course.location ?? "Location not recorded"} · {course.coverName ? `${course.coverName} (cover)` : course.instructor?.name ?? "Instructor not assigned"}</Text>
                          <HStack gap={2} wrap="wrap" hAlign="between" vAlign="center">
                            <Text color="secondary">{capacityLabel(course._count.enrolments, course.capacity)}</Text>
                            {access.courses ? <Link className="inline-flex min-h-11 items-center" href={`/courses/${course.id}`} isStandalone>Open {courseName(course)}</Link> : null}
                          </HStack>
                        </VStack>
                      ))}
                    </VStack>
                  ))}
                </div>
              )}
            </VStack>
          </Card>
        </section>
      </div>
    </VStack>
  );
}
