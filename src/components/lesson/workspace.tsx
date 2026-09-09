"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  CloudCheck,
  LoaderCircle,
  NotebookPen,
  Users,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/primitives/tabs";
import { Button } from "@/components/workspace/actions";
import { Banner, Avatar, EmptyState } from "@/components/workspace/feedback";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/workspace/choices";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmLevel } from "@/components/progression/assessment";
import { Tag } from "@/components/ui-kit/tag";
import { LessonDraft, type DraftStorage } from "@/lib/lesson/draft";
import { saveLesson } from "@/lib/lesson/actions";
import type { LessonData, SavedLesson } from "@/lib/lesson/schema";
import { same } from "@/lib/lesson/schema";
import { ATTENDANCE_STATUS_META } from "@/lib/attendance/constants";
import { COMPETENCY_STATUS_META } from "@/lib/progression/constants";
import { fullName } from "@/lib/students/constants";
import type { RegisterLine } from "@/lib/attendance/data/register";
const storage: DraftStorage = {
  getItem: (key) =>
    typeof window === "undefined" ? null : localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};
type Skill = { id: string; name: string; description: string | null };
type Props = {
  persist?: typeof saveLesson;
  courseId: string;
  date: string;
  draftKey: string;
  initial: SavedLesson;
  lines: RegisterLine[];
  skills: Skill[];
  levelId: string;
  levelName: string;
  canMark: boolean;
  canAssess: boolean;
  canComplete: boolean;
  canOverride: boolean;
  completedIds: string[];
  initialView?: "attendance" | "competencies";
};
const saveLabels = {
  idle: "Up to date",
  queued: "Changes ready to save",
  saving: "Saving…",
  saved: "Saved",
  offline: "Stored on this device",
  error: "Could not save",
  conflict: "Review conflicting changes",
};
export function LessonWorkspace(props: Props) {
  const router = useRouter();
  const [draft] = useState(
    () =>
      new LessonDraft(
        props.draftKey,
        props.initial,
        (data, revision, complete) =>
          (props.persist ?? saveLesson)({
            courseId: props.courseId,
            date: props.date,
            data,
            revision,
            complete,
          }),
        storage,
        { canWrite: () => props.canMark },
      ),
  );
  const state = useSyncExternalStore(
    draft.subscribe,
    draft.getSnapshot,
    draft.getServerSnapshot,
  );
  const [mode, setMode] = useState("class");
  const [skillId, setSkillId] = useState(props.skills[0]?.id ?? "");
  const [swimmerId, setSwimmerId] = useState(props.lines[0]?.studentId ?? "");
  useEffect(() => {
    draft.start();
    const retry = () => void draft.flush();
    window.addEventListener("online", retry);
    const leave = (event: BeforeUnloadEvent) => {
      if (draft.getSnapshot().dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      draft.dispose();
      window.removeEventListener("online", retry);
      window.removeEventListener("beforeunload", leave);
    };
  }, [draft]);
  const changed = (change: (data: LessonData) => void, attendance = false) =>
    draft.update(change, attendance);
  const unresolved = Object.values(state.data.attendance).filter(
    (mark) => mark.status === null,
  ).length;
  const present = Object.values(state.data.attendance).filter(
    (mark) => mark.status === "PRESENT" || mark.status === "LATE",
  ).length;
  const skill = props.skills.find((item) => item.id === skillId);
  const swimmer = props.lines.find((line) => line.studentId === swimmerId);
  const names = new Map(
    props.lines.map((line) => [line.studentId, fullName(line)]),
  );
  const competencyControl = (studentId: string, competencyId: string) => (
    <SegmentedControl
      label={`${names.get(studentId)}: ${props.skills.find((item) => item.id === competencyId)?.name}`}
      size="lg"
      value={state.data.competencies[studentId]?.[competencyId] ?? "unmarked"}
      isDisabled={!props.canAssess}
      onChange={(value) =>
        changed((data) => {
          data.competencies[studentId][competencyId] =
            value === "unmarked" ? null : (value as "WORKING_ON" | "ACHIEVED");
        })
      }
    >
      <SegmentedControlItem value="unmarked" label="Not assessed" />
      <SegmentedControlItem value="WORKING_ON" label="Working on" />
      <SegmentedControlItem value="ACHIEVED" label="Achieved" />
    </SegmentedControl>
  );
  return (
    <div className="lesson-workspace">
      <div className="lesson-save-line">
        <div
          role="status"
          aria-live="polite"
          className={`lesson-save-state ${state.status}`}
        >
          {state.status === "saving" ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <CloudCheck size={17} />
          )}
          <span>
            {state.storageWarning && state.dirty
              ? "Unsaved — device storage unavailable"
              : saveLabels[state.status]}
          </span>
        </div>
        <span className="muted small">Changes save automatically</span>
      </div>
      {state.storageWarning ? (
        <Banner
          status="warning"
          title="This browser could not store the draft"
          description="Keep this tab open until the changes are confirmed saved."
        />
      ) : null}
      {state.error && !state.conflict ? (
        <Banner
          status={state.status === "offline" ? "warning" : "error"}
          title={state.error}
          endContent={
            <Button
              label="Retry save"
              variant="secondary"
              onClick={() => void draft.flush()}
            />
          }
        />
      ) : null}
      {state.conflict ? (
        <section className="lesson-conflict">
          <Banner
            status="warning"
            title="Someone else changed this lesson"
            description="Your draft is safe. Review the differences, then choose which changes to keep."
          />
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Changed field</th>
                  <th>Your draft</th>
                  <th>Saved version</th>
                </tr>
              </thead>
              <tbody>
                {differences(
                  state.data,
                  state.conflict.data,
                  names,
                  new Map(props.skills.map((item) => [item.id, item.name])),
                ).map((row, index) => (
                  <tr key={index}>
                    <th scope="row">{row.label}</th>
                    <td>{row.mine}</td>
                    <td>{row.saved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              label="Use saved version"
              variant="secondary"
              onClick={() => {
                draft.resolveConflict("saved");
                router.refresh();
              }}
            />
            <Button
              label="Keep my changes"
              isDisabled={!props.canMark}
              onClick={() => {
                draft.resolveConflict("mine");
                router.refresh();
              }}
            />
          </div>
        </section>
      ) : null}
      <Tabs defaultValue={props.initialView ?? "attendance"} className="gap-6">
        <TabsList aria-label="Class workspace" className="lesson-tabs">
          <TabsTrigger value="attendance">
            <Users size={17} />
            Attendance{state.complete ? <Check size={16} /> : null}
          </TabsTrigger>
          <TabsTrigger value="competencies">
            <NotebookPen size={17} />
            Competencies
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="attendance"
          keepMounted
          className="data-hidden:hidden"
        >
          <section className="lesson-panel">
            <div className="lesson-panel-heading">
              <div>
                <p className="eyebrow">In the water</p>
                <h2>Attendance</h2>
                <p className="muted mt-1">
                  {present} present ·{" "}
                  {unresolved
                    ? `${unresolved} still to mark`
                    : `${props.lines.length} swimmers checked`}
                </p>
              </div>
              {state.complete ? (
                <Tag color="green">Complete</Tag>
              ) : (
                <Tag color="yellow">To finish</Tag>
              )}
            </div>
            {props.lines.length ? (
              <>
                <div className="lesson-roster">
                  {props.lines.map((line) => (
                    <div key={line.studentId} className="lesson-attendance-row">
                      <div className="lesson-swimmer">
                        <Avatar name={fullName(line)} />
                        <div>
                          <h3>{fullName(line)}</h3>
                          <p className="muted small">
                            {line.levelName}
                            {line.offRoster ? " · No longer in this class" : ""}
                          </p>
                          {line.medicalNotes ? (
                            <details className="lesson-care">
                              <summary>Care note</summary>
                              <p>{line.medicalNotes}</p>
                            </details>
                          ) : null}
                        </div>
                      </div>
                      <div className="lesson-mark-and-note">
                        <SegmentedControl
                          label={`Attendance for ${fullName(line)}`}
                          value={
                            state.data.attendance[line.studentId]?.status ?? ""
                          }
                          size="lg"
                          isDisabled={!props.canMark}
                          onChange={(value) =>
                            changed((data) => {
                              data.attendance[line.studentId].status = value as
                                | "PRESENT"
                                | "LATE"
                                | "ABSENT";
                            }, true)
                          }
                        >
                          <SegmentedControlItem
                            value="PRESENT"
                            label="Present"
                          />
                          <SegmentedControlItem value="LATE" label="Late" />
                          <SegmentedControlItem value="ABSENT" label="Absent" />
                        </SegmentedControl>
                        <details className="lesson-note">
                          <summary>
                            {state.data.attendance[line.studentId]?.note
                              ? "Attendance note"
                              : "Add a note"}
                          </summary>
                          <Textarea
                            label={`Attendance note for ${fullName(line)}`}
                            maxLength={200}
                            rows={2}
                            value={
                              state.data.attendance[line.studentId]?.note ?? ""
                            }
                            disabled={!props.canMark || state.data.attendance[line.studentId]?.status === null}
                            onChange={(event) =>
                              changed((data) => {
                                data.attendance[line.studentId].note =
                                  event.target.value;
                              }, true)
                            }
                          />
                          {state.data.attendance[line.studentId]?.status === null && (
                            <p className="text-sm text-muted-foreground">Mark attendance first, then add a note.</p>
                          )}
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="lesson-note-area">
                  <Textarea
                    label="Class note"
                    placeholder="Anything the next instructor should know?"
                    value={state.data.note}
                    maxLength={300}
                    disabled={!props.canMark}
                    rows={2}
                    onChange={(event) =>
                      changed((data) => {
                        data.note = event.target.value;
                      }, true)
                    }
                  />
                </div>
                <div className="lesson-attendance-footer">
                  <p className="muted">
                    {state.complete
                      ? "The roster has been checked. Changing attendance reopens it."
                      : "Check every swimmer, then confirm the roster is finished."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unresolved && props.canMark ? (
                      <Button
                        label="Mark remaining present"
                        variant="secondary"
                        onClick={() =>
                          changed((data) => {
                            for (const mark of Object.values(data.attendance))
                              if (mark.status === null) mark.status = "PRESENT";
                          }, true)
                        }
                      />
                    ) : null}
                    <Button
                      label={
                        state.complete
                          ? "Attendance complete"
                          : state.completing
                            ? "Confirming…"
                            : "Done taking attendance"
                      }
                      icon={<CheckCircle2 size={18} />}
                      isDisabled={
                        !props.canMark ||
                        state.dirty ||
                        unresolved > 0 ||
                        state.complete ||
                        !!state.conflict
                      }
                      onClick={() => draft.finishAttendance()}
                    />
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title="No swimmers on this register"
                description="Choose another week or review this class's enrolments."
                icon={<Users size={28} />}
              />
            )}
          </section>
        </TabsContent>
        <TabsContent
          value="competencies"
          keepMounted
          className="data-hidden:hidden"
        >
          <section className="lesson-panel">
            <div className="lesson-panel-heading">
              <div>
                <p className="eyebrow">Small steps, real progress</p>
                <h2>{props.levelName} competencies</h2>
                <p className="muted mt-1">
                  {props.skills.length} skills · {props.lines.length} swimmers
                </p>
              </div>
            </div>
            {!props.canAssess ? (
              <div className="lesson-inset">
                <Banner
                  status="info"
                  title="You can view these marks. Assessing needs the progression permission."
                />
              </div>
            ) : null}
            <div className="lesson-competency-controls">
              <SegmentedControl
                label="Marking view"
                value={mode}
                onChange={setMode}
              >
                <SegmentedControlItem value="class" label="Across the class" />
                <SegmentedControlItem value="swimmer" label="One swimmer" />
              </SegmentedControl>
              {mode === "class" ? (
                <Select
                  label="Competency"
                  value={skillId}
                  onValueChange={setSkillId}
                  options={props.skills.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              ) : (
                <Select
                  label="Swimmer"
                  value={swimmerId}
                  onValueChange={setSwimmerId}
                  options={props.lines.map((line) => ({
                    value: line.studentId,
                    label: fullName(line),
                  }))}
                />
              )}
            </div>
            {mode === "class" && skill ? (
              <>
                <div className="lesson-skill-heading">
                  <h3>{skill.name}</h3>
                  {skill.description ? (
                    <p className="muted mt-1">{skill.description}</p>
                  ) : null}
                </div>
                <div className="lesson-roster">
                  {props.lines.map((line) => (
                    <div className="lesson-competency-row" key={line.studentId}>
                      <div className="lesson-swimmer">
                        <Avatar name={fullName(line)} />
                        <div>
                          <h3>{fullName(line)}</h3>
                          <p className="small muted">
                            {state.data.attendance[line.studentId]?.status
                              ? ATTENDANCE_STATUS_META[
                                  state.data.attendance[line.studentId].status!
                                ].label
                              : "Attendance unmarked"}
                            {line.levelName &&
                            line.levelName !== props.levelName
                              ? ` · Enrolled at ${line.levelName}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      {competencyControl(line.studentId, skill.id)}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {mode === "swimmer" && swimmer ? (
              <>
                <div className="lesson-skill-heading">
                  <h3>{fullName(swimmer)}</h3>
                  <p className="muted mt-1">
                    {
                      Object.values(
                        state.data.competencies[swimmer.studentId] ?? {},
                      ).filter((value) => value === "ACHIEVED").length
                    }{" "}
                    of {props.skills.length} achieved
                  </p>
                </div>
                <div className="lesson-roster">
                  {props.skills.map((item) => (
                    <div className="lesson-competency-row" key={item.id}>
                      <div className="min-w-0 flex-1">
                        <h3>{item.name}</h3>
                        {item.description ? (
                          <p className="small muted mt-1">{item.description}</p>
                        ) : null}
                      </div>
                      {competencyControl(swimmer.studentId, item.id)}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {!props.skills.length || !props.lines.length ? (
              <EmptyState
                title="Nothing to assess yet"
                description="This class needs a roster and a level with competencies."
              />
            ) : null}
            {props.canComplete ? (
              <div className="lesson-ready">
                <h3>Level completion</h3>
                <p className="muted small mt-1">
                  Confirm a level separately once its saved checklist is ready.
                </p>
                {state.dirty ? (
                  <p className="muted mt-3">
                    Waiting for the latest marks to save…
                  </p>
                ) : (
                  props.lines.map((line) => {
                    const count = Object.values(
                      state.data.competencies[line.studentId] ?? {},
                    ).filter((value) => value === "ACHIEVED").length;
                    const eligible =
                      props.skills.length > 0 && count === props.skills.length;
                    if (props.completedIds.includes(line.studentId))
                      return (
                        <p key={line.studentId} className="mt-3">
                          {fullName(line)}{" "}
                          <Tag color="green">Level completed</Tag>
                        </p>
                      );
                    if (!eligible && !props.canOverride) return null;
                    return (
                      <div className="lesson-ready-row" key={line.studentId}>
                        <span>
                          {fullName(line)}{" "}
                          <span className="muted">
                            · {count}/{props.skills.length}
                          </span>
                        </span>
                        <ConfirmLevel
                          studentId={line.studentId}
                          studentName={fullName(line)}
                          levelId={props.levelId}
                          levelName={props.levelName}
                          achieved={count}
                          total={props.skills.length}
                          eligible={eligible}
                          admin={props.canOverride}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
function differences(
  mine: LessonData,
  saved: LessonData,
  names: Map<string, string>,
  skills: Map<string, string>,
) {
  const rows: { label: string; mine: string; saved: string }[] = [];
  const attendance = (mark: LessonData["attendance"][string] | undefined) =>
    mark
      ? `${mark.status ? ATTENDANCE_STATUS_META[mark.status].label : "Not marked"}${mark.note ? ` · ${mark.note}` : ""}`
      : "Not on roster";
  for (const id of new Set([
    ...Object.keys(mine.attendance),
    ...Object.keys(saved.attendance),
  ]))
    if (!same(mine.attendance[id], saved.attendance[id]))
      rows.push({
        label: `${names.get(id) ?? "Roster changed"} · attendance`,
        mine: attendance(mine.attendance[id]),
        saved: attendance(saved.attendance[id]),
      });
  const mark = (value: "WORKING_ON" | "ACHIEVED" | null | undefined) =>
    value ? COMPETENCY_STATUS_META[value].label : "Not assessed";
  for (const id of new Set([
    ...Object.keys(mine.competencies),
    ...Object.keys(saved.competencies),
  ]))
    for (const skill of new Set([
      ...Object.keys(mine.competencies[id] ?? {}),
      ...Object.keys(saved.competencies[id] ?? {}),
    ]))
      if (mine.competencies[id]?.[skill] !== saved.competencies[id]?.[skill])
        rows.push({
          label: `${names.get(id) ?? "Swimmer"} · ${skills.get(skill) ?? "Checklist changed"}`,
          mine: mark(mine.competencies[id]?.[skill]),
          saved: mark(saved.competencies[id]?.[skill]),
        });
  if (mine.note !== saved.note)
    rows.push({
      label: "Class note",
      mine: mine.note || "No note",
      saved: saved.note || "No note",
    });
  return rows.length
    ? rows
    : [
        {
          label: "Record updated",
          mine: "Your marks are retained",
          saved: "The saved version or roster changed",
        },
      ];
}
