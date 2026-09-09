"use client";

import { Card, Progress, ButtonLink, NativeSelect, Textarea } from "./ui";

import { endTime } from "../lib/format";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Mail,
  MapPin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { ASSESSMENTS, CLUBS, COMPETENCIES, SWIMMERS } from "../lib/fixtures";
import type { DeskCommand, SwimClass, Swimmer } from "../lib/types";
import { useDemo } from "./provider";
import {
  Avatar,
  Button,
  EmptyState,
  Modal,
  Notice,
  Pill,
  SegmentTabs,
  TextInput,
} from "./ui";

type FormKind = "enrol" | "move" | "assessment";
interface FormState {
  kind: FormKind;
  swimmerId: string;
  fromClassId?: string;
  targetId?: string;
}
export function Reception() {
  const { state, store } = useDemo();
  const [mobileView, setMobileView] = useState("swimmer");
  const [profileTab, setProfileTab] = useState("overview");
  const [form, setForm] = useState<FormState | null>(null);
  const [timeFilter, setTimeFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = SWIMMERS.find(
    (swimmer) =>
      swimmer.id === state.selectedId && swimmer.clubId === state.clubId,
  );
  const courses = state.desk.classes.filter(
    (course) => course.clubId === state.clubId,
  );
  const results = SWIMMERS.filter(
    (swimmer) =>
      swimmer.clubId === state.clubId &&
      `${swimmer.name} ${swimmer.memberNumber} ${swimmer.contact}`
        .toLowerCase()
        .includes(state.query.toLowerCase().trim()),
  );
  const places = courses.filter((course) =>
    course.swimmerIds.includes(selected?.id ?? ""),
  );
  const selectedLesson = places[0]
    ? store.lesson(places[0]).getSnapshot().data
    : null;
  const achieved = selected
    ? Object.values(selectedLesson?.competencies[selected.id] ?? {}).filter(
        (mark) => mark === "ACHIEVED",
      ).length
    : 0;
  const matches = selected
    ? courses.filter(
        (course) =>
          course.level === selected.level &&
          !course.swimmerIds.includes(selected.id) &&
          course.swimmerIds.length < course.capacity,
      )
    : [];
  function choose(swimmer: Swimmer) {
    store.selectSwimmer(swimmer.id);
    setProfileTab("overview");
    setMobileView("swimmer");
  }
  return (
    <div className="reception-page">
      <div className="page-heading">
        <div>
          <h1>Reception</h1>
          <p className="page-description">
            Find a swimmer and plan their next step.
          </p>
        </div>
        <div className="heading-detail">
          <span className="live-dot" />
          Ready for the afternoon
        </div>
      </div>
      <div className="search-workspace">
        <div className="search-control">
          <Search size={21} aria-hidden="true" />
          <TextInput
            ref={inputRef}
            aria-label="Find a swimmer"
            type="search"
            placeholder="Search swimmers…"
            value={state.query}
            onChange={(event) => store.setQuery(event.target.value)}
            autoComplete="off"
          />
          {state.query && (
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Clear swimmer search"
              onClick={() => {
                store.setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={18} />
            </Button>
          )}
        </div>
        <span className="search-hint">
          <Users size={16} />
          {CLUBS[state.clubId]} swimmers
        </span>
      </div>
      {state.query.trim() && (
        <section className="search-results" aria-label="Swimmer search results">
          <p className="small muted" role="status">
            {results.length} {results.length === 1 ? "swimmer" : "swimmers"}{" "}
            found
          </p>
          {results.length ? (
            <ul>
              {results.map((swimmer) => (
                <li key={swimmer.id}>
                  <Button
                    variant="ghost"
                    className="search-result"
                    onClick={() => choose(swimmer)}
                  >
                    <Avatar initials={swimmer.initials} size="small" />
                    <span>
                      <strong>{swimmer.name}</strong>
                      <span className="small muted">
                        {swimmer.memberNumber} · Age {swimmer.age} ·{" "}
                        {swimmer.level}
                      </span>
                    </span>
                    {!swimmer.active && <Pill>Inactive</Pill>}
                    <ChevronRight size={18} />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No swimmers found">
              Try another name, contact name or member number.
            </EmptyState>
          )}
        </section>
      )}
      <div className="mobile-view-switch" aria-label="Reception view">
        <Button
          variant="ghost"
          aria-pressed={mobileView === "swimmer"}
          onClick={() => setMobileView("swimmer")}
        >
          Swimmer
        </Button>
        <Button
          variant="ghost"
          aria-pressed={mobileView === "today"}
          onClick={() => setMobileView("today")}
        >
          Today’s classes
        </Button>
      </div>
      <div className="reception-grid">
        <Card
          role="region"
          className={`gap-0 py-0 swimmer-workspace mobile-panel ${mobileView !== "swimmer" ? "mobile-hidden" : ""}`}
          aria-label="Swimmer workspace"
        >
          {selected ? (
            <>
              <div className="profile-heading">
                <Avatar initials={selected.initials} size="large" />
                <div className="profile-identity">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2>{selected.name}</h2>
                    <Pill tone={selected.active ? "success" : "neutral"}>
                      {selected.active ? "Active" : "Inactive"}
                    </Pill>
                  </div>
                  <p>
                    Age {selected.age} <span className="dot-separator">·</span>{" "}
                    {selected.memberNumber}
                  </p>
                  <span className="level-label">
                    <WavesSmall />
                    {selected.level}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  className="icon-button change-swimmer"
                  aria-label="Find another swimmer"
                  onClick={() => inputRef.current?.focus()}
                >
                  <Search size={19} />
                </Button>
              </div>
              <div className="profile-actions">
                <Button
                  disabled={!store.can("enrolment.manage") || !selected.active}
                  onClick={() =>
                    setForm({ kind: "enrol", swimmerId: selected.id })
                  }
                >
                  <Plus size={18} /> Enrol in a class
                </Button>
                <Button
                  variant="secondary"
                  disabled={!store.can("enrolment.manage") || !selected.active}
                  onClick={() =>
                    setForm({ kind: "assessment", swimmerId: selected.id })
                  }
                >
                  <CalendarCheck size={18} /> Book assessment
                </Button>
              </div>
              <SegmentTabs
                label="Swimmer information"
                value={profileTab}
                onChange={setProfileTab}
                items={[
                  {
                    value: "overview",
                    label: "Overview",
                    content: (
                      <div className="profile-body">
                        {selected.note && (
                          <div className="care-note">
                            <Heart size={19} aria-hidden="true" />
                            <div>
                              <strong>Good to know</strong>
                              <p>{selected.note}</p>
                            </div>
                          </div>
                        )}
                        <section className="profile-section">
                          <div className="section-heading">
                            <h3>Current classes</h3>
                            <span className="small muted">
                              {places.length}{" "}
                              {places.length === 1 ? "place" : "places"}
                            </span>
                          </div>
                          {places.length ? (
                            <ul className="current-classes">
                              {places.map((course) => (
                                <li key={course.id}>
                                  <div className="course-icon">
                                    <CalendarDays size={22} />
                                  </div>
                                  <div className="class-description">
                                    <strong>{course.level}</strong>
                                    <span>
                                      Tuesday · {course.start}–
                                      {endTime(course.start)}
                                    </span>
                                    <span className="small muted">
                                      {course.location} · {course.instructor}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    className="move-button"
                                    aria-label={`Move ${selected.name} from ${course.level} at ${course.start}`}
                                    disabled={!store.can("enrolment.manage")}
                                    onClick={() =>
                                      setForm({
                                        kind: "move",
                                        swimmerId: selected.id,
                                        fromClassId: course.id,
                                      })
                                    }
                                  >
                                    <ArrowLeftRight size={16} /> Move
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyState title="Ready for a first class">
                              Find a suitable class and enrol{" "}
                              {selected.name.split(" ")[0]}.
                            </EmptyState>
                          )}
                        </section>
                        <section className="profile-section">
                          <div className="section-heading">
                            <h3>Progress at a glance</h3>
                            <Button
                              variant="ghost"
                              className="text-button"
                              onClick={() => setProfileTab("progress")}
                            >
                              View progress <ArrowRight size={15} />
                            </Button>
                          </div>
                          <div className="progress-summary">
                            <div>
                              <strong>{selected.level}</strong>
                              <span className="muted">
                                {achieved} of {COMPETENCIES.length} competencies
                                achieved
                              </span>
                            </div>
                            <Progress
                              max={COMPETENCIES.length}
                              value={achieved}
                              aria-label={`${selected.name} competency progress`}
                            />
                          </div>
                        </section>
                        <section className="profile-section">
                          <h3>Family contact</h3>
                          <div className="contact-row">
                            <Avatar
                              initials={selected.contact
                                .split(" ")
                                .map((name) => name[0])
                                .join("")}
                              size="small"
                            />
                            <div>
                              <strong>{selected.contact}</strong>
                              <span className="small muted">
                                Parent / guardian
                              </span>
                            </div>
                          </div>
                          <div className="contact-details">
                            <span>
                              <Mail size={16} />
                              {selected.email}
                            </span>
                            <span className="small muted">
                              {selected.phone}
                            </span>
                          </div>
                        </section>
                        {state.desk.bookings.some(
                          (booking) => booking.swimmerId === selected.id,
                        ) && (
                          <section className="profile-section">
                            <h3>Booked assessments</h3>
                            {state.desk.bookings
                              .filter(
                                (booking) => booking.swimmerId === selected.id,
                              )
                              .map((booking) => {
                                const session = ASSESSMENTS.find(
                                  (item) => item.id === booking.sessionId,
                                )!;
                                return (
                                  <p
                                    className="assessment-booking"
                                    key={booking.sessionId}
                                  >
                                    <CalendarCheck size={18} />
                                    {session.date} · {session.time}
                                    <Pill tone="success">Booked</Pill>
                                  </p>
                                );
                              })}
                          </section>
                        )}
                      </div>
                    ),
                  },
                  {
                    value: "progress",
                    label: "Progress",
                    content: (
                      <section className="profile-body">
                        <h3>{selected.level} competencies</h3>
                        <p className="muted section-description">
                          A clear view of what’s achieved and what comes next.
                        </p>
                        <ul className="competency-summary">
                          {COMPETENCIES.map((skill) => (
                            <li key={skill.id}>
                              <span
                                className={
                                  selectedLesson?.competencies[selected.id]?.[
                                    skill.id
                                  ] === "ACHIEVED"
                                    ? "skill-check achieved"
                                    : "skill-check"
                                }
                              >
                                <Check size={15} />
                              </span>
                              <div>
                                <strong>{skill.name}</strong>
                                <span className="small muted">
                                  {selectedLesson?.competencies[selected.id]?.[
                                    skill.id
                                  ] === "ACHIEVED"
                                    ? "Achieved"
                                    : "Still to achieve"}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                        {places[0] && (
                          <ButtonLink
                            href={`/class/${places[0].id}`}
                            variant="secondary"
                          >
                            Open class workspace <ArrowRight size={16} />
                          </ButtonLink>
                        )}
                      </section>
                    ),
                  },
                  {
                    value: "history",
                    label: "History",
                    content: (
                      <section className="profile-body">
                        <h3>Recent activity</h3>
                        {state.desk.activity.filter((entry) =>
                          entry.label.includes(selected.name),
                        ).length ? (
                          <ul className="activity-list">
                            {state.desk.activity
                              .filter((entry) =>
                                entry.label.includes(selected.name),
                              )
                              .map((entry) => (
                                <li key={entry.id}>
                                  <span className="activity-dot" />
                                  <div>
                                    <p>{entry.label}</p>
                                    <span className="small muted">
                                      Alex Murphy ·{" "}
                                      {new Date(entry.time).toLocaleTimeString(
                                        "en-IE",
                                        { hour: "2-digit", minute: "2-digit" },
                                      )}
                                    </span>
                                  </div>
                                </li>
                              ))}
                          </ul>
                        ) : (
                          <EmptyState title="A fresh start">
                            Enrolments, class moves and assessment bookings made
                            in this preview appear here.
                          </EmptyState>
                        )}
                      </section>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <EmptyState title="Find your next swimmer">
              Search by name or member number to see their classes, contacts and
              progress.
            </EmptyState>
          )}
        </Card>
        <Card
          role="region"
          className={`gap-0 py-0 timetable-workspace mobile-panel ${mobileView !== "today" ? "mobile-hidden" : ""}`}
          aria-label="Today’s classes"
        >
          <div className="timetable-heading">
            <div>
              <h2>Today at the pool</h2>
              <p className="muted">Tuesday 8 September</p>
            </div>
            <span className="date-tile">
              <span>SEP</span>
              <strong>08</strong>
            </span>
          </div>
          <div className="next-up-strip">
            <Clock3 size={19} />
            <div>
              <strong>First classes start in 10 minutes</strong>
              <span>Turtles and Dolphins · 15:30</span>
            </div>
          </div>
          <div
            className="timetable-filters"
            aria-label="Filter today’s classes"
          >
            <Button
              variant="ghost"
              className={
                timeFilter === "all"
                  ? "filter-button is-active"
                  : "filter-button"
              }
              aria-pressed={timeFilter === "all"}
              onClick={() => setTimeFilter("all")}
            >
              All classes <span>{courses.length}</span>
            </Button>
            <Button
              variant="ghost"
              className={
                timeFilter === "available"
                  ? "filter-button is-active"
                  : "filter-button"
              }
              aria-pressed={timeFilter === "available"}
              onClick={() => setTimeFilter("available")}
            >
              Places available
            </Button>
          </div>
          <div className="timetable-list">
            {["15:30", "16:00", "16:30"].map((time) => {
              const rows = courses.filter(
                (course) =>
                  course.start === time &&
                  (timeFilter === "all" ||
                    course.swimmerIds.length < course.capacity),
              );
              return rows.length ? (
                <section key={time} className="time-group">
                  <h3>
                    <span>{time}</span>
                    {time === "15:30" && (
                      <span className="time-caption">Up next</span>
                    )}
                  </h3>
                  {rows.map((course) => (
                    <CourseRow key={course.id} course={course} />
                  ))}
                </section>
              ) : null;
            })}
          </div>
          {selected && matches.length > 0 && (
            <div className="suggested-place">
              <div className="suggestion-icon">
                <Users size={21} />
              </div>
              <div>
                <strong>A class that fits {selected.name.split(" ")[0]}</strong>
                <p>
                  {matches[0].level} at {matches[0].start} has{" "}
                  {matches[0].capacity - matches[0].swimmerIds.length} places
                  available.
                </p>
                <Button
                  variant="ghost"
                  className="text-button"
                  disabled={!store.can("enrolment.manage") || !selected.active}
                  onClick={() =>
                    setForm({
                      kind: places.length ? "move" : "enrol",
                      swimmerId: selected.id,
                      fromClassId: places[0]?.id,
                      targetId: matches[0].id,
                    })
                  }
                >
                  View this option <ArrowRight size={15} />
                </Button>
              </div>
            </div>
          )}
          <Link href="/today" className="timetable-footer">
            Open the poolside workspace <ArrowRight size={17} />
          </Link>
        </Card>
      </div>
      {form && (
        <BookingForm
          key={`${form.kind}:${form.swimmerId}:${form.fromClassId ?? ""}`}
          form={form}
          close={() => setForm(null)}
        />
      )}
    </div>
  );
}
function WavesSmall() {
  return <span className="level-dot" aria-hidden="true" />;
}
function CourseRow({ course }: { course: SwimClass }) {
  const available = course.capacity - course.swimmerIds.length;
  return (
    <Link href={`/class/${course.id}`} className="timetable-row">
      <div className="timetable-row-main">
        <strong>{course.level}</strong>
        <span>
          <MapPin size={13} />
          {course.location}
        </span>
      </div>
      <div className="timetable-row-end">
        <Pill tone={available ? "success" : "neutral"}>
          {available ? `${available} places` : "Full"}
        </Pill>
        <span className="small muted">
          {course.swimmerIds.length} / {course.capacity} enrolled
        </span>
      </div>
      <ChevronRight size={16} />
    </Link>
  );
}
function BookingForm({ form, close }: { form: FormState; close: () => void }) {
  const { store, state } = useDemo();
  const swimmer = SWIMMERS.find((row) => row.id === form.swimmerId)!;
  const [target, setTarget] = useState(form.targetId ?? "");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const targetClass = state.desk.classes.find((course) => course.id === target);
  const title =
    form.kind === "enrol"
      ? "Enrol in a class"
      : form.kind === "move"
        ? "Move to another class"
        : "Book an assessment";
  const source = state.desk.classes.find(
    (course) => course.id === form.fromClassId,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!target) {
      setError(
        form.kind === "assessment"
          ? "Choose an assessment session."
          : "Choose a class.",
      );
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    const command: DeskCommand =
      form.kind === "assessment"
        ? { type: "assessment", swimmerId: swimmer.id, sessionId: target }
        : form.kind === "move"
          ? {
              type: "move",
              swimmerId: swimmer.id,
              classId: target,
              fromClassId: form.fromClassId!,
              reason,
            }
          : { type: "enrol", swimmerId: swimmer.id, classId: target, reason };
    try {
      const result = await store.commit(command);
      if (result.ok) close();
      else setError(result.error);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <Modal
      open
      onClose={close}
      title={title}
      description={`For ${swimmer.name} · ${CLUBS[swimmer.clubId]}`}
      busy={pending}
    >
      <form onSubmit={submit} aria-busy={pending} className="booking-form">
        {source && (
          <div className="form-context">
            <span className="small muted">Current class</span>
            <strong>
              {source.level} · Tuesday {source.start}
            </strong>
            <p>This place stays booked until the move succeeds.</p>
          </div>
        )}
        <label className="field-label" htmlFor="booking-choice">
          {form.kind === "assessment" ? "Assessment session" : "Choose a class"}
        </label>
        <NativeSelect
          id="booking-choice"
          className="input"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          disabled={pending}
        >
          <option value="">
            {form.kind === "assessment" ? "Select a session" : "Select a class"}
          </option>
          {form.kind === "assessment"
            ? ASSESSMENTS.filter(
                (session) => session.clubId === swimmer.clubId,
              ).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.date} · {session.time} ·{" "}
                  {session.capacity -
                    state.desk.bookings.filter(
                      (booking) => booking.sessionId === session.id,
                    ).length}{" "}
                  places
                </option>
              ))
            : state.desk.classes
                .filter(
                  (course) =>
                    course.clubId === swimmer.clubId &&
                    course.id !== form.fromClassId,
                )
                .map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.level} · Tuesday {course.start} ·{" "}
                    {course.capacity - course.swimmerIds.length > 0
                      ? `${course.capacity - course.swimmerIds.length} places`
                      : "Full"}
                    {course.swimmerIds.includes(swimmer.id)
                      ? " · Already enrolled"
                      : ""}
                  </option>
                ))}
        </NativeSelect>
        {targetClass && (
          <div className="selection-detail">
            <CalendarDays size={20} />
            <div>
              <strong>
                {targetClass.level} · {targetClass.start}–
                {endTime(targetClass.start)}
              </strong>
              <span>
                {targetClass.location} · {targetClass.instructor}
              </span>
            </div>
          </div>
        )}
        {targetClass && targetClass.level !== swimmer.level && (
          <label className="field-label">
            Placement reason
            <Textarea
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={300}
              disabled={pending}
              placeholder={`Explain why this class suits a swimmer at ${swimmer.level} level.`}
            />
          </label>
        )}
        {form.kind === "assessment" && (
          <p className="muted">
            Swim School Assessments are free. The instructor records a placement
            afterwards.
          </p>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="modal-actions">
          <Button
            variant="secondary"
            disabled={pending}
            type="button"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending || !store.can("enrolment.manage")}
          >
            {pending
              ? "Saving…"
              : form.kind === "move"
                ? "Confirm move"
                : form.kind === "assessment"
                  ? "Confirm booking"
                  : "Confirm enrolment"}
            <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
