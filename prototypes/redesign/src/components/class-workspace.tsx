"use client";

import {
  Card,
  Textarea,
  NativeSelect,
  ToggleGroup,
  ToggleGroupItem,
} from "./ui";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  CloudCheck,
  CloudUpload,
  Heart,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { CLUBS, COMPETENCIES, SWIMMERS } from "../lib/fixtures";
import type { Attendance, Mark, SaveState, SwimClass } from "../lib/types";
import { useDemo, useLesson } from "./provider";
import {
  Avatar,
  Button,
  EmptyState,
  Modal,
  Notice,
  Pill,
  SegmentTabs,
} from "./ui";
import { endTime } from "../lib/format";

const ATTENDANCE_META: Record<
  Attendance,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  PRESENT: { label: "Present", tone: "success" },
  LATE: { label: "Late", tone: "warning" },
  ABSENT: { label: "Absent", tone: "neutral" },
};
const SAVE_LABELS: Record<SaveState, string> = {
  idle: "Changes save automatically",
  queued: "Waiting to save…",
  saving: "Saving changes…",
  saved: "All changes saved",
  offline: "Saved on this device",
  error: "Could not save yet",
  conflict: "Review another instructor’s changes",
};
export function ClassWorkspace({ id }: { id: string }) {
  const { state } = useDemo();
  const course = state.desk.classes.find(
    (row) => row.id === id && row.clubId === state.clubId,
  );
  return course ? (
    <Lesson key={course.id} course={course} />
  ) : (
    <EmptyState title="This class is not in the selected club">
      <Link href="/today" className="text-button">
        Go to today’s classes <ArrowRight size={16} />
      </Link>
    </EmptyState>
  );
}
function Lesson({ course }: { course: SwimClass }) {
  const { store, state } = useDemo();
  const { controller, lesson } = useLesson(course);
  const [tab, setTab] = useState("attendance");
  const [view, setView] = useState("skill");
  const [skillId, setSkillId] = useState(COMPETENCIES[0].id);
  const [swimmerId, setSwimmerId] = useState(course.swimmerIds[0] ?? "");
  const [confirmation, setConfirmation] = useState<"cover" | string | null>(
    null,
  );
  const swimmers = SWIMMERS.filter((swimmer) =>
    course.swimmerIds.includes(swimmer.id),
  );
  const skill = COMPETENCIES.find((row) => row.id === skillId)!;
  const focusedSwimmer =
    swimmers.find((row) => row.id === swimmerId) ?? swimmers[0];
  const canMark =
    store.can("attendance.mark") &&
    (course.instructor === "Alex Murphy" ||
      lesson.data.cover === "Alex Murphy");
  const canAssess = canMark && store.can("progression.assess");
  const present = Object.values(lesson.data.attendance).filter(
    (value) => value === "PRESENT" || value === "LATE",
  ).length;
  const done = lesson.data.attendanceDone && !lesson.dirty;
  const dirtyCompletion = lesson.data.attendanceDone && lesson.dirty;
  const StatusIcon =
    lesson.status === "offline"
      ? WifiOff
      : lesson.status === "saved"
        ? CloudCheck
        : lesson.status === "saving"
          ? CloudUpload
          : Info;
  function markAttendance(id: string, status: Attendance) {
    if (canMark)
      controller.update((data) => {
        data.attendance[id] = status;
      }, true);
  }
  function markCompetency(id: string, competencyId: string, status: Mark) {
    if (canAssess)
      controller.update((data) => {
        data.competencies[id] ??= {};
        data.competencies[id][competencyId] = status;
      });
  }
  function competencyChoices(id: string, competencyId: string, label: string) {
    const mark = lesson.data.competencies[id]?.[competencyId] ?? null;
    return (
      <ToggleGroup
        className="mark-controls"
        variant="default"
        spacing={1}
        aria-label={label}
        value={[mark ?? "NOT_MARKED"]}
        disabled={!canAssess}
        onValueChange={(values) => {
          const next = values[0];
          if (next)
            markCompetency(
              id,
              competencyId,
              next === "NOT_MARKED" ? null : (next as Mark),
            );
        }}
      >
        <ToggleGroupItem value="NOT_MARKED" aria-label={`${label}: not marked`}>
          Not marked
        </ToggleGroupItem>
        <ToggleGroupItem value="WORKING_ON" aria-label={`${label}: working on`}>
          Working on
        </ToggleGroupItem>
        <ToggleGroupItem
          value="ACHIEVED"
          className="achieved-button"
          aria-label={`${label}: achieved`}
        >
          <Check size={15} />
          Achieved
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }
  return (
    <div className="class-page">
      <Link href="/today" className="back-link">
        <ArrowLeft size={17} />
        Today’s classes
      </Link>
      <div className="page-heading class-heading">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1>{course.level}</h1>
            <Pill tone="blue">{CLUBS[course.clubId]}</Pill>
          </div>
          <p className="page-description">
            <Clock3 size={16} />
            Tuesday · {course.start}–{endTime(course.start)}
            <span className="dot-separator">·</span>
            <MapPin size={16} />
            {course.location}
          </p>
        </div>
        <div className="instructor-detail">
          <Avatar
            initials={
              lesson.data.cover
                ? "AM"
                : course.instructor
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
            }
            size="small"
          />
          <div>
            <span className="small muted">
              {lesson.data.cover ? "Covering today" : "Instructor"}
            </span>
            <strong>{lesson.data.cover ?? course.instructor}</strong>
          </div>
        </div>
      </div>
      {!canMark && store.can("attendance.mark") && (
        <div className="cover-prompt">
          <div>
            <strong>Taking this class today?</strong>
            <p>Declare cover to record your name and begin marking.</p>
          </div>
          <Button onClick={() => setConfirmation("cover")}>
            I’m covering this class <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <Card className="gap-0 py-0 lesson-workspace">
        <div className="lesson-status">
          <span>
            <Users size={18} />
            <strong>{swimmers.length} swimmers</strong>
            <span className="status-divider" />
            <span>{present} in the water</span>
          </span>
          <span
            className={`save-status save-${lesson.status}`}
            role="status"
            aria-label="Save status"
          >
            <StatusIcon size={17} />
            {lesson.storageWarning && lesson.status === "offline"
              ? "Not yet saved"
              : SAVE_LABELS[lesson.status]}
          </span>
        </div>
        {lesson.storageWarning && (
          <Notice tone="error">
            Browser storage is unavailable. Keep this tab open until your
            changes are confirmed saved.
          </Notice>
        )}
        {(lesson.status === "error" || lesson.status === "offline") && (
          <div className="save-notice">
            <div>
              <strong>
                {lesson.status === "offline"
                  ? "You can keep going."
                  : "Your changes are still here."}
              </strong>
              <p>
                {lesson.storageWarning
                  ? "Keep this tab open. We’ll try again when the connection is back."
                  : "Changes are kept on this device. We’ll retry automatically when we can."}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={!canMark}
              onClick={() => void controller.flush()}
            >
              <RefreshCw size={16} />
              Try again
            </Button>
          </div>
        )}
        {lesson.conflict && (
          <section className="conflict-panel" aria-label="Save conflict">
            <h2>Another instructor saved changes</h2>
            <p>
              Your draft is still here. Choose the saved version, or replace it
              with your draft.
            </p>
            <div className="conflict-comparison">
              <div>
                <h3>Saved version</h3>
                <p>{lesson.conflict.data.note || "No class note"}</p>
                <span>
                  {
                    Object.values(lesson.conflict.data.attendance).filter(
                      (value) => value !== "ABSENT",
                    ).length
                  }{" "}
                  swimmers present or late
                </span>
              </div>
              <div>
                <h3>Your draft</h3>
                <p>{lesson.data.note || "No class note"}</p>
                <span>{present} swimmers present or late</span>
              </div>
            </div>
            <details>
              <summary>Compare attendance and competency marks</summary>
              <ul>
                {swimmers.map((swimmer) => (
                  <li key={swimmer.id}>
                    <strong>{swimmer.name}</strong>
                    <p>
                      Saved:{" "}
                      {
                        ATTENDANCE_META[
                          lesson.conflict!.data.attendance[swimmer.id] ??
                            "ABSENT"
                        ].label
                      }{" "}
                      · Your draft:{" "}
                      {
                        ATTENDANCE_META[
                          lesson.data.attendance[swimmer.id] ?? "ABSENT"
                        ].label
                      }
                    </p>
                    {COMPETENCIES.filter(
                      (item) =>
                        (lesson.conflict!.data.competencies[swimmer.id]?.[
                          item.id
                        ] ?? null) !==
                        (lesson.data.competencies[swimmer.id]?.[item.id] ??
                          null),
                    ).map((item) => (
                      <p key={item.id}>
                        {item.name}: saved{" "}
                        {markLabel(
                          lesson.conflict!.data.competencies[swimmer.id]?.[
                            item.id
                          ] ?? null,
                        )}
                        ; your draft{" "}
                        {markLabel(
                          lesson.data.competencies[swimmer.id]?.[item.id] ??
                            null,
                        )}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            </details>
            <div className="flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                onClick={() => controller.resolveConflict("saved")}
              >
                Use saved version
              </Button>
              <Button
                disabled={!canMark}
                onClick={() => controller.resolveConflict("mine")}
              >
                Keep my changes
              </Button>
            </div>
          </section>
        )}
        <SegmentTabs
          label="Class workspace"
          value={tab}
          onChange={setTab}
          items={[
            {
              value: "attendance",
              label: "Attendance",
              content: (
                <section className="attendance-panel">
                  <div className="roster-heading">
                    <div>
                      <h2>Who’s in the water?</h2>
                      <p className="muted">
                        Check each swimmer. Your marks save as you go.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!canMark || !swimmers.length}
                      onClick={() =>
                        controller.update((data) => {
                          swimmers.forEach((swimmer) => {
                            data.attendance[swimmer.id] = "PRESENT";
                          });
                        }, true)
                      }
                    >
                      <CheckCheck size={17} />
                      Everyone present
                    </Button>
                  </div>
                  {swimmers.length ? (
                    <ul className="roster">
                      {swimmers.map((swimmer) => {
                        const status =
                          lesson.data.attendance[swimmer.id] ?? "ABSENT";
                        return (
                          <li key={swimmer.id} className="roster-row">
                            <div className="roster-person">
                              <Avatar initials={swimmer.initials} />
                              <div>
                                <strong>{swimmer.name}</strong>
                                <span className="small muted">
                                  Age {swimmer.age}
                                </span>
                              </div>
                            </div>
                            <ToggleGroup
                              variant="default"
                              spacing={1}
                              value={[status]}
                              className="attendance-controls"
                              aria-label={`Attendance for ${swimmer.name}`}
                              disabled={!canMark}
                              onValueChange={(values) => {
                                if (values[0])
                                  markAttendance(
                                    swimmer.id,
                                    values[0] as Attendance,
                                  );
                              }}
                            >
                              {(
                                ["PRESENT", "LATE", "ABSENT"] as Attendance[]
                              ).map((value) => (
                                <ToggleGroupItem
                                  value={value}
                                  key={value}
                                  className={`attendance-choice choice-${ATTENDANCE_META[value].tone}`}
                                  aria-label={`${swimmer.name}: ${ATTENDANCE_META[value].label}`}
                                >
                                  {value === "PRESENT" && <Check size={16} />}
                                  {ATTENDANCE_META[value].label}
                                </ToggleGroupItem>
                              ))}
                            </ToggleGroup>
                            {swimmer.note && (
                              <details className="roster-care">
                                <summary>
                                  <Heart size={14} />
                                  Care note for {swimmer.name.split(" ")[0]}
                                </summary>
                                <p>{swimmer.note}</p>
                              </details>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyState title="No swimmers in this class yet">
                      Reception can enrol swimmers as places are booked.
                    </EmptyState>
                  )}
                  <div className="class-note">
                    <label htmlFor="class-note">
                      A note for this class{" "}
                      <span className="muted">Optional</span>
                    </label>
                    <Textarea
                      id="class-note"
                      className="input"
                      placeholder="Anything useful for the next lesson…"
                      maxLength={300}
                      value={lesson.data.note}
                      disabled={!canMark}
                      onChange={(event) =>
                        controller.update((data) => {
                          data.note = event.target.value;
                        })
                      }
                    />
                  </div>
                  <div className="attendance-finish">
                    <div>
                      <span className={`finish-icon ${done ? "is-done" : ""}`}>
                        <ShieldCheck size={22} />
                      </span>
                      <div>
                        <strong>
                          {done
                            ? "Attendance is complete"
                            : dirtyCompletion
                              ? "Confirming attendance…"
                              : "Everyone checked?"}
                        </strong>
                        <p>
                          {done
                            ? "Your class is ready. Move on to competencies whenever you like."
                            : "Finish once you’ve checked the whole roster."}
                        </p>
                      </div>
                    </div>
                    {done ? (
                      <Button
                        variant="secondary"
                        onClick={() => setTab("competencies")}
                      >
                        Competencies <ArrowRight size={17} />
                      </Button>
                    ) : (
                      <Button
                        disabled={
                          !canMark ||
                          lesson.dirty ||
                          lesson.status === "saving" ||
                          !!lesson.conflict ||
                          !swimmers.length
                        }
                        onClick={() => controller.finishAttendance()}
                      >
                        <Check size={17} />
                        Done taking attendance
                      </Button>
                    )}
                  </div>
                </section>
              ),
            },
            {
              value: "competencies",
              label: "Competencies",
              content: (
                <section className="competencies-panel">
                  <div className="roster-heading">
                    <div>
                      <h2>Competencies</h2>
                      <p className="muted">
                        Mark what you see, in the order that works for you.
                      </p>
                    </div>
                  </div>
                  <div className="competency-toolbar">
                    <ToggleGroup
                      variant="default"
                      spacing={1}
                      value={[view]}
                      onValueChange={(values) => {
                        if (values[0]) setView(values[0]);
                      }}
                      className="segmented-buttons"
                      aria-label="Competency view"
                    >
                      <ToggleGroupItem value="skill">
                        By competency
                      </ToggleGroupItem>
                      <ToggleGroupItem value="swimmer">
                        By swimmer
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <label className="skill-picker">
                      <span className="sr-only">
                        {view === "skill"
                          ? "Choose competency"
                          : "Choose swimmer"}
                      </span>
                      <NativeSelect
                        value={
                          view === "skill"
                            ? skillId
                            : (focusedSwimmer?.id ?? "")
                        }
                        onChange={(event) =>
                          view === "skill"
                            ? setSkillId(event.target.value)
                            : setSwimmerId(event.target.value)
                        }
                        aria-label={
                          view === "skill"
                            ? "Choose competency"
                            : "Choose swimmer"
                        }
                      >
                        {view === "skill"
                          ? COMPETENCIES.map((item, index) => (
                              <option key={item.id} value={item.id}>
                                {index + 1}. {item.name}
                              </option>
                            ))
                          : swimmers.map((swimmer) => (
                              <option key={swimmer.id} value={swimmer.id}>
                                {swimmer.name}
                              </option>
                            ))}
                      </NativeSelect>
                    </label>
                  </div>
                  {view === "skill" ? (
                    <>
                      <div className="skill-description">
                        <span className="skill-number">
                          {COMPETENCIES.findIndex(
                            (item) => item.id === skillId,
                          ) + 1}
                          <span>/{COMPETENCIES.length}</span>
                        </span>
                        <div>
                          <h3>{skill.name}</h3>
                          <p>{skill.description}</p>
                        </div>
                      </div>
                      <ul className="competency-roster">
                        {swimmers.map((swimmer) => (
                          <li key={swimmer.id}>
                            <div className="roster-person">
                              <Avatar initials={swimmer.initials} />
                              <div>
                                <strong>{swimmer.name}</strong>
                                <span className="small muted">
                                  {
                                    Object.values(
                                      lesson.data.competencies[swimmer.id] ??
                                        {},
                                    ).filter((mark) => mark === "ACHIEVED")
                                      .length
                                  }{" "}
                                  of {COMPETENCIES.length} achieved
                                </span>
                              </div>
                            </div>
                            {competencyChoices(
                              swimmer.id,
                              skill.id,
                              `${swimmer.name}, ${skill.name}`,
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="next-skill">
                        <Button
                          variant="secondary"
                          disabled={skillId === COMPETENCIES.at(-1)!.id}
                          onClick={() =>
                            setSkillId(
                              COMPETENCIES[
                                COMPETENCIES.findIndex(
                                  (item) => item.id === skillId,
                                ) + 1
                              ].id,
                            )
                          }
                        >
                          Next competency <ChevronRight size={16} />
                        </Button>
                      </div>
                    </>
                  ) : focusedSwimmer ? (
                    <>
                      <div className="swimmer-checklist-heading">
                        <Avatar initials={focusedSwimmer.initials} />
                        <div>
                          <h3>{focusedSwimmer.name}</h3>
                          <p className="muted">
                            {course.level} · {COMPETENCIES.length} competencies
                          </p>
                        </div>
                      </div>
                      <ul className="competency-roster by-swimmer">
                        {COMPETENCIES.map((item) => (
                          <li key={item.id}>
                            <div>
                              <strong>{item.name}</strong>
                              <p className="small muted">{item.description}</p>
                            </div>
                            {competencyChoices(
                              focusedSwimmer.id,
                              item.id,
                              `${focusedSwimmer.name}, ${item.name}`,
                            )}
                          </li>
                        ))}
                      </ul>
                      {COMPETENCIES.every(
                        (item) =>
                          lesson.data.competencies[focusedSwimmer.id]?.[
                            item.id
                          ] === "ACHIEVED",
                      ) && (
                        <div className="level-completion">
                          <ShieldCheck size={23} />
                          <div>
                            <strong>
                              {lesson.data.completedSwimmers.includes(
                                focusedSwimmer.id,
                              )
                                ? "Level confirmed"
                                : "Ready for a level review"}
                            </strong>
                            <p>
                              All competencies achieved. An instructor confirms
                              the level.
                            </p>
                          </div>
                          <Button
                            disabled={
                              !canAssess ||
                              !store.can("progression.complete") ||
                              lesson.dirty ||
                              lesson.data.completedSwimmers.includes(
                                focusedSwimmer.id,
                              )
                            }
                            onClick={() => setConfirmation(focusedSwimmer.id)}
                          >
                            Confirm level
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState title="No swimmers to mark">
                      Enrol swimmers from Reception to begin.
                    </EmptyState>
                  )}
                </section>
              ),
            },
          ]}
        />
      </Card>
      <div className="lesson-footnote">
        <CloudCheck size={17} />
        <p>Marks belong to the swimmer. Attendance belongs to today’s class.</p>
      </div>
      {confirmation && (
        <Modal
          open
          onClose={() => setConfirmation(null)}
          title={
            confirmation === "cover"
              ? "Confirm you’re covering"
              : "Confirm level completion"
          }
          description={
            confirmation === "cover"
              ? `Your name will be recorded on ${course.level} at ${course.start}.`
              : `Confirm that ${SWIMMERS.find((swimmer) => swimmer.id === confirmation)?.name} has completed ${course.level}.`
          }
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmation === "cover")
                  controller.update((data) => {
                    data.cover = "Alex Murphy";
                  });
                else
                  controller.update((data) => {
                    if (!data.completedSwimmers.includes(confirmation))
                      data.completedSwimmers.push(confirmation);
                  });
                setConfirmation(null);
              }}
            >
              Confirm <Check size={17} />
            </Button>
          </div>
        </Modal>
      )}
      {state.network === "offline" && (
        <span className="sr-only">Connection simulation is offline.</span>
      )}
    </div>
  );
}
function markLabel(value: Mark) {
  return value === "ACHIEVED"
    ? "achieved"
    : value === "WORKING_ON"
      ? "working on"
      : "not marked";
}
