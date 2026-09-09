"use client";

import { ToggleGroup, ToggleGroupItem, Card, ButtonLink } from "./ui";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Heart,
  MapPin,
  Users,
} from "lucide-react";
import { CLUBS, SWIMMERS, initials } from "../lib/fixtures";
import { useDemo } from "./provider";
import { Avatar, Pill } from "./ui";
import { endTime } from "../lib/format";

export function Today() {
  const { store, state } = useDemo();
  const [mine, setMine] = useState(false);
  const courses = state.desk.classes.filter(
    (course) =>
      course.clubId === state.clubId &&
      (!mine ||
        course.instructor === "Alex Murphy" ||
        store.lesson(course).getSnapshot().data.cover === "Alex Murphy"),
  );
  const next = courses[0];
  const nextLesson = next ? store.lesson(next).getSnapshot() : undefined;
  const careNotes = next
    ? SWIMMERS.filter(
        (swimmer) => next.swimmerIds.includes(swimmer.id) && swimmer.note,
      ).length
    : 0;
  const nextInstructor = nextLesson?.data.cover ?? next?.instructor ?? "";
  const unfinished = courses.filter((course) => {
    const lesson = store.lesson(course).getSnapshot();
    return !lesson.data.attendanceDone || lesson.dirty;
  }).length;
  return (
    <div className="today-page">
      <div className="page-heading">
        <div>
          <h1>Today at the pool</h1>
          <p className="page-description">
            Tuesday 8 September · {CLUBS[state.clubId]}
          </p>
        </div>
        <span className="date-caption">
          <CalendarDays size={18} /> Today
        </span>
      </div>
      <div className="today-toolbar">
        <ToggleGroup
          className="segmented-buttons"
          aria-label="Classes to show"
          variant="default"
          spacing={1}
          value={[mine ? "mine" : "all"]}
          onValueChange={(values) => {
            if (values[0]) setMine(values[0] === "mine");
          }}
        >
          <ToggleGroupItem value="all">All classes</ToggleGroupItem>
          <ToggleGroupItem value="mine">My classes</ToggleGroupItem>
        </ToggleGroup>
        <span className="small muted">
          {courses.length} classes this afternoon
        </span>
      </div>
      {next && (
        <Card role="region" className="gap-0 py-0 next-class">
          <div className="next-class-content">
            <Pill tone="blue">
              <Clock3 size={13} /> Starting in 10 minutes
            </Pill>
            <h2>{next.level}</h2>
            <p>
              {next.start}–{endTime(next.start)} <span>·</span> {next.location}
            </p>
            <div className="next-class-people">
              <Users size={18} />
              {next.swimmerIds.length}{" "}
              {next.swimmerIds.length === 1 ? "swimmer" : "swimmers"}{" "}
              <span>·</span>
              <Avatar initials={initials(nextInstructor)} size="small" />
              {nextInstructor}
            </div>
            <ButtonLink href={`/class/${next.id}`}>
              Open class <ArrowRight size={18} />
            </ButtonLink>
          </div>
          <div className="lesson-reminder">
            <h3>Before you start</h3>
            <p>Check the roster and care notes before the lesson.</p>
            <div className="preparation-item">
              <Users size={18} />
              <span>Attendance</span>
              <Pill
                tone={
                  nextLesson?.data.attendanceDone && !nextLesson.dirty
                    ? "success"
                    : "neutral"
                }
              >
                {nextLesson?.data.attendanceDone && !nextLesson.dirty
                  ? "Complete"
                  : "To finish"}
              </Pill>
            </div>
            <div className="preparation-item">
              <Heart size={18} />
              <span>Care notes</span>
              <strong>
                {careNotes ? `${careNotes} to read` : "None recorded"}
              </strong>
            </div>
          </div>
        </Card>
      )}
      <div className="section-heading schedule-heading">
        <h2>Today’s classes</h2>
        <span className="muted small">{unfinished} awaiting attendance</span>
      </div>
      <Card className="gap-0 py-0 schedule-table">
        <div className="schedule-header">
          <span>Time</span>
          <span>Class & pool</span>
          <span>Instructor</span>
          <span>Attendance</span>
          <span />
        </div>
        {courses.map((course) => {
          const lesson = store.lesson(course).getSnapshot();
          const done = lesson.data.attendanceDone && !lesson.dirty;
          return (
            <Link
              key={course.id}
              className="schedule-row"
              href={`/class/${course.id}`}
            >
              <span className="schedule-time">
                {course.start}
                <span>{endTime(course.start)}</span>
              </span>
              <div className="schedule-class">
                <strong>{course.level}</strong>
                <span>
                  <MapPin size={13} />
                  {course.location} · {course.swimmerIds.length}{" "}
                  {course.swimmerIds.length === 1 ? "swimmer" : "swimmers"}
                </span>
              </div>
              <span className="schedule-instructor">
                {lesson.data.cover ?? course.instructor}
                {lesson.data.cover && (
                  <span className="small muted">Cover</span>
                )}
              </span>
              <span>
                <Pill
                  tone={
                    done
                      ? "success"
                      : lesson.revision || lesson.dirty
                        ? "warning"
                        : "neutral"
                  }
                >
                  {done
                    ? "Complete"
                    : lesson.revision || lesson.dirty
                      ? "In progress"
                      : "To take"}
                </Pill>
              </span>
              <ArrowRight size={18} />
            </Link>
          );
        })}
      </Card>
      <div className="poolside-tip">
        <span className="live-dot" />
        <p>
          Your marks save as you go. Finish attendance when you’ve checked
          everyone.
        </p>
      </div>
    </div>
  );
}
