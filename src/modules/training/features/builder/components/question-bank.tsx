"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, GraduationCap, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { EXAM_DEFAULTS, paperSize, QUESTION_KIND_META, QUESTION_KINDS, type ExamSettings, type Question, type QuestionKind } from "@/modules/training/shared/questions";
import { addQuestion, moveQuestion, removeQuestion, saveExam, saveQuestion, type QuestionInput } from "@/modules/training/features/builder/server/actions";
import { uploadCourseFile, type UploadedFile } from "@/modules/training/features/builder/components/rich-text";

/** Questions and the final exam in the builder (docs/training.md, e-learning
 *  phase 2). A section's questions feed its Quiz lessons and the course's
 *  final exam; the exam's rules and how it has gone sit on their own page. */

export type ExamReport = { sittings: number; passed: number; questions: Record<string, { asked: number; missed: number }> };

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (run: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    const result = await run();
    if (!result.ok) toast.error(result.error ?? "That didn't save. Try again.");
    else { after?.(); router.refresh(); }
  });
  return { act, pending };
}

const missedLine = (stat: { asked: number; missed: number } | undefined) =>
  stat?.asked ? `Missed by ${Math.round((stat.missed / stat.asked) * 100)}% of ${stat.asked} ${stat.asked === 1 ? "sitting" : "sittings"}` : null;

// ---------------------------------------------------------------------------
// A section's questions
// ---------------------------------------------------------------------------

export function QuestionsPanel({ courseId, section, questions, quizzes, files, onUploaded, canEdit, report }: {
  courseId: string; section: { id: string; title: string }; questions: Question[]; quizzes: string[];
  files: UploadedFile[]; onUploaded: (file: UploadedFile) => void; canEdit: boolean; report: ExamReport;
}) {
  const { act, pending } = useAct();
  const router = useRouter();
  return (
    <section className="pc-panel flex flex-col gap-5" aria-labelledby="questions-heading">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">Questions · {questions.length}</p>
          <h2 id="questions-heading" className="truncate text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">{section.title}</h2>
        </div>
        {canEdit ? <QuestionDialog courseId={courseId} sectionId={section.id} files={files} onUploaded={onUploaded} onSaved={() => router.refresh()} /> : null}
      </div>
      <p className="text-sm text-ui-muted-foreground">
        {quizzes.length ? `Learners practise these in ${quizzes.map((q) => `“${q}”`).join(" and ")}. ` : "Add a Quiz lesson to this section to let learners practise these. "}
        The final exam draws from every section’s questions.
      </p>
      {questions.length === 0 ? (
        <EmptyState compact icon="graduation" title="No questions yet" hint={canEdit ? "Add a question about what this section teaches." : undefined} />
      ) : (
        <ol className="pc-rows">
          {questions.map((q, i) => (
            <li key={q.id} className="pc-row items-start">
              <span className="pc-row-body">
                <span className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{i + 1} · {QUESTION_KIND_META[q.kind].label}</span>
                <span className="pc-row-title">{q.prompt}</span>
                <AnswerSummary question={q} />
                {missedLine(report.questions[q.id]) ? <span className="pc-row-hint">{missedLine(report.questions[q.id])}</span> : null}
              </span>
              {canEdit ? (
                <span className="flex shrink-0 gap-1">
                  <QuestionDialog courseId={courseId} sectionId={section.id} question={q} files={files} onUploaded={onUploaded} onSaved={() => router.refresh()} />
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move question ${i + 1} up`} disabled={pending || i === 0} onClick={() => act(() => moveQuestion(q.id, "up"))}><ArrowUp aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move question ${i + 1} down`} disabled={pending || i === questions.length - 1} onClick={() => act(() => moveQuestion(q.id, "down"))}><ArrowDown aria-hidden="true" /></Button>
                  <ConfirmAction
                    trigger={<Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove question ${i + 1}`}><Trash2 aria-hidden="true" /></Button>}
                    title="Remove this question?"
                    description="It goes from the draft only. Published versions and past results keep it."
                    confirmLabel="Remove question"
                    destructive
                    successMessage="Question removed"
                    run={async () => { const result = await removeQuestion(q.id); if (result.ok) router.refresh(); return result; }}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The right answer in a line, so an author can check a question without opening it. */
function AnswerSummary({ question: q }: { question: Question }) {
  const text = q.kind === "ORDER" ? q.options.map((o, i) => `${i + 1}. ${o.text}`).join("  ")
    : q.kind === "MATCH" ? q.options.map((o) => `${o.text} → ${o.match}`).join(" · ")
    : `Right: ${q.options.filter((o) => o.correct).map((o) => o.text || "a picture").join(", ")}`;
  return <span className="pc-row-hint">{text}</span>;
}

// ---------------------------------------------------------------------------
// Writing one question
// ---------------------------------------------------------------------------

type DraftOption = { key: string; id?: string; text: string; imageId: string | null; correct: boolean; match: string };
let keys = 0;
const blank = (): DraftOption => ({ key: `o${++keys}`, text: "", imageId: null, correct: false, match: "" });
const fromQuestion = (q?: Question): DraftOption[] => q?.options.length
  ? q.options.map((o) => ({ ...o, key: `o${++keys}` }))
  : [blank(), blank(), blank()];

function QuestionDialog({ courseId, sectionId, question, files, onUploaded, onSaved }: {
  courseId: string; sectionId: string; question?: Question; files: UploadedFile[]; onUploaded: (file: UploadedFile) => void; onSaved: () => void;
}) {
  const [kind, setKind] = useState<QuestionKind>(question?.kind ?? "SINGLE");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [imageId, setImageId] = useState<string | null>(question?.imageId ?? null);
  const [options, setOptions] = useState<DraftOption[]>(fromQuestion(question));
  const [truth, setTruth] = useState<"true" | "false" | "">(question?.kind === "TRUE_FALSE" ? (question.options.find((o) => o.correct)?.id as "true" | "false") ?? "" : "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const images = files.filter((f) => f.mime.startsWith("image/"));
  function reset() {
    setKind(question?.kind ?? "SINGLE"); setPrompt(question?.prompt ?? ""); setImageId(question?.imageId ?? null);
    setOptions(fromQuestion(question)); setExplanation(question?.explanation ?? ""); setFileError("");
    setTruth(question?.kind === "TRUE_FALSE" ? (question.options.find((o) => o.correct)?.id as "true" | "false") ?? "" : "");
  }
  const update = (key: string, patch: Partial<DraftOption>) => setOptions((now) => now.map((o) => o.key === key ? { ...o, ...patch } : o));
  const move = (index: number, by: -1 | 1) => setOptions((now) => {
    const next = [...now];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return next;
  });
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setFileError("");
    try { const added = await uploadCourseFile(courseId, file); onUploaded(added); setImageId(added.id); }
    catch (caught) { setFileError((caught as Error).message); }
    finally { setUploading(false); }
  }
  function input(): QuestionInput {
    const used = kind === "TRUE_FALSE"
      ? [{ id: "true", text: "True", imageId: null, correct: truth === "true", match: "" }, { id: "false", text: "False", imageId: null, correct: truth === "false", match: "" }]
      : options.filter((o) => o.text.trim() || o.imageId || o.match.trim()).map(({ id, text, imageId: img, correct, match }) => ({ id, text, imageId: img, correct, match }));
    return { kind, prompt, imageId, options: used, explanation };
  }
  const choice = kind === "SINGLE" || kind === "MULTIPLE";
  const single = options.find((o) => o.correct)?.key ?? "";
  const rows = options.map((o, i) => (
              <div key={o.key} className="flex flex-wrap items-end gap-2 rounded-[var(--pc-radius-card)] bg-ui-muted p-3">
                {kind === "SINGLE" ? (
                  <span className="flex min-h-11 items-center"><RadioGroupItem value={o.key} id={`right-${o.key}`} aria-label={`Option ${i + 1} is the right answer`} /></span>
                ) : kind === "MULTIPLE" ? (
                  <span className="flex min-h-11 items-center"><Checkbox id={`right-${o.key}`} checked={o.correct} onCheckedChange={(checked) => update(o.key, { correct: checked === true })} aria-label={`Option ${i + 1} is right`} /></span>
                ) : null}
                <Input id={`opt-${o.key}`} label={kind === "ORDER" ? `Step ${i + 1}` : kind === "MATCH" ? `Item ${i + 1}` : `Option ${i + 1}`} value={o.text} onChange={(value) => update(o.key, { text: value })} maxLength={300} className="min-w-0 flex-1" />
                {kind === "MATCH" ? <Input id={`match-${o.key}`} label="Its partner" value={o.match} onChange={(value) => update(o.key, { match: value })} maxLength={300} className="min-w-0 flex-1" /> : null}
                {choice && images.length ? (
                  <Field label="Picture" htmlFor={`optimg-${o.key}`}>
                    <NativeSelect id={`optimg-${o.key}`} value={o.imageId ?? ""} onChange={(event) => update(o.key, { imageId: event.target.value || null })} className="min-h-11">
                      <NativeSelectOption value="">None</NativeSelectOption>
                      {images.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
                    </NativeSelect>
                  </Field>
                ) : null}
                <span className="flex gap-1">
                  {kind === "ORDER" ? (
                    <>
                      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden="true" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move step ${i + 1} down`} disabled={i === options.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden="true" /></Button>
                    </>
                  ) : null}
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove ${kind === "ORDER" ? "step" : kind === "MATCH" ? "pair" : "option"} ${i + 1}`} disabled={options.length <= 2}
                    onClick={() => setOptions((now) => now.filter((x) => x.key !== o.key))}><X aria-hidden="true" /></Button>
                </span>
              </div>
            ));
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={question
        ? <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Edit the question: ${question.prompt.slice(0, 60)}`}><Pencil aria-hidden="true" /></Button>
        : <Button type="button" className="min-h-11"><Plus aria-hidden="true" />Add a question</Button>}
      title={question ? "Edit question" : "Add a question"}
      description="Every question marks itself. Keep it to one thing the learner must know."
      submitLabel={question ? "Save question" : "Add question"}
      successMessage={question ? "Question saved" : "Question added"}
      onOpen={reset}
      onSuccess={onSaved}
      submit={async () => {
        const result = question ? await saveQuestion(question.id, input()) : await addQuestion(sectionId, input());
        return result.ok ? { ok: true } : result;
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Kind of question</legend>
        <RadioGroup value={kind} onValueChange={(value) => {
          const next = value as QuestionKind;
          // One right answer keeps only the first mark when coming from several.
          if (next === "SINGLE") setOptions((now) => { let seen = false; return now.map((o) => { const keep = o.correct && !seen; seen ||= o.correct; return { ...o, correct: keep }; }); });
          setKind(next);
        }} className="grid gap-2 sm:grid-cols-2">
          {QUESTION_KINDS.map((k) => <ChoiceRow key={k} type="radio" value={k} id={`qkind-${question?.id ?? sectionId}-${k}`} title={QUESTION_KIND_META[k].label} hint={QUESTION_KIND_META[k].help} />)}
        </RadioGroup>
      </fieldset>

      <Textarea id={`q-prompt-${question?.id ?? "new"}`} label={kind === "TRUE_FALSE" ? "Statement" : kind === "ORDER" ? "What to put in order" : "Question"}
        value={prompt} onChange={(event) => setPrompt(event.target.value)} required minLength={3} maxLength={1000} rows={2}
        placeholder={kind === "TRUE_FALSE" ? "Free chlorine should be between 1.0 and 1.5 mg/l." : kind === "ORDER" ? "Put the steps of a water test in order." : "What do you do if a reading is out of range?"} />

      <Field label="Picture (optional)" htmlFor={`q-image-${question?.id ?? "new"}`} hint="Shown above the question.">
        <div className="flex flex-col gap-2">
          <NativeSelect id={`q-image-${question?.id ?? "new"}`} value={imageId ?? ""} onChange={(event) => setImageId(event.target.value || null)} className="min-h-11 w-full">
            <NativeSelectOption value="">No picture</NativeSelectOption>
            {images.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
          </NativeSelect>
          <FileField label="Or add a picture" description="JPEG, PNG or WebP, up to 4 MB." accept="image/png,image/jpeg,image/webp" pending={uploading} onChange={(event) => upload(event.target.files?.[0])} error={fileError || undefined} />
        </div>
      </Field>

      {kind === "TRUE_FALSE" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">The statement is</legend>
          <RadioGroup value={truth} onValueChange={(value) => setTruth(value as "true" | "false")} className="grid gap-2 sm:grid-cols-2">
            <ChoiceRow type="radio" value="true" id={`truth-${question?.id ?? "new"}-t`} title="True" />
            <ChoiceRow type="radio" value="false" id={`truth-${question?.id ?? "new"}-f`} title="False" />
          </RadioGroup>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">
            {kind === "ORDER" ? "Steps, in the right order" : kind === "MATCH" ? "Pairs" : kind === "SINGLE" ? "Options: mark the right one" : "Options: tick every right one"}
          </legend>
          {kind === "ORDER" ? <p className="text-sm text-ui-muted-foreground">Learners get them shuffled and put them back in this order.</p> : null}
          {kind === "MATCH" ? <p className="text-sm text-ui-muted-foreground">Learners match each item on the left with its partner, shown shuffled.</p> : null}
          {kind === "SINGLE" ? (
            <RadioGroup value={single} onValueChange={(key) => setOptions((now) => now.map((o) => ({ ...o, correct: o.key === key })))} className="flex flex-col gap-3">
              {rows}
            </RadioGroup>
          ) : <div className="flex flex-col gap-3">{rows}</div>}
          {options.length < 8 ? (
            <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setOptions((now) => [...now, blank()])}>
              <Plus aria-hidden="true" />{kind === "ORDER" ? "Add a step" : kind === "MATCH" ? "Add a pair" : "Add an option"}
            </Button>
          ) : null}
          {choice && !images.length ? <p className="flex items-center gap-2 text-sm text-ui-muted-foreground"><ImagePlus aria-hidden="true" className="size-4" />Add a picture above to use pictures as answers too.</p> : null}
        </fieldset>
      )}

      <Textarea id={`q-why-${question?.id ?? "new"}`} label="Why (optional)" optional value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={1000} rows={2}
        description="Shown once the learner gets it right, and in the review after a passed exam. Never shown before." />
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// The final exam
// ---------------------------------------------------------------------------

export function ExamPanel({ courseId, exam, questions, sections, canEdit, report }: {
  courseId: string; exam: ExamSettings | null; questions: Question[]; sections: { id: string; title: string }[]; canEdit: boolean; report: ExamReport;
}) {
  const { act, pending } = useAct();
  const start = exam ?? EXAM_DEFAULTS;
  const [on, setOn] = useState(!!exam);
  const [passMark, setPassMark] = useState(String(start.passMark));
  const [attempts, setAttempts] = useState(String(start.attempts));
  const [draw, setDraw] = useState(start.draw ? String(start.draw) : "");
  const [timeLimit, setTimeLimit] = useState(start.timeLimit ? String(start.timeLimit) : "");
  const [testOut, setTestOut] = useState(start.testOut);
  const [dirty, setDirty] = useState(false);
  const change = <T,>(set: (value: T) => void) => (value: T) => { set(value); setDirty(true); };
  const num = (value: string) => value.trim() ? Number(value) : null;
  const save = () => act(() => saveExam(courseId, on ? {
    passMark: Number(passMark), attempts: Number(attempts), draw: num(draw), timeLimit: num(timeLimit), testOut,
  } : null), () => { setDirty(false); toast.success(on ? "Exam saved" : "Exam turned off"); });
  const size = paperSize({ ...start, draw: num(draw) }, questions.length);
  const missed = questions
    .map((q) => ({ q, stat: report.questions[q.id], section: sections.find((s) => s.id === q.sectionId)?.title ?? "" }))
    .filter((row) => row.stat?.asked && row.stat.missed > 0)
    .sort((a, b) => b.stat!.missed / b.stat!.asked - a.stat!.missed / a.stat!.asked)
    .slice(0, 10);
  return (
    <section className="pc-panel flex flex-col gap-5" aria-labelledby="exam-heading">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">End of the course</p>
          <h2 id="exam-heading" className="text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">Final exam</h2>
        </div>
      </div>
      <Switch id="exam-on" label="Learners sit a final exam" description="Marked on the server. They finish the course once they pass." checked={on} onCheckedChange={change(setOn)} disabled={!canEdit} labelSpacing="spread" />
      {on ? (
        <>
          <p className="text-sm text-ui-muted-foreground tabular-nums">
            {questions.length ? `${size} of the ${questions.length} questions in this course on each paper, in a different order for everyone.` : "Add questions to the sections first: the exam draws from them."}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="exam-pass" label="Pass mark (%)" type="number" inputMode="numeric" min={1} max={100} value={passMark} onChange={change(setPassMark)} required disabled={!canEdit} />
            <Input id="exam-attempts" label="Attempts" type="number" inputMode="numeric" min={1} max={10} value={attempts} onChange={change(setAttempts)} required disabled={!canEdit}
              description="After the last one, a trainer can give another." />
            <Input id="exam-draw" label="Questions on each paper" type="number" inputMode="numeric" min={1} max={300} value={draw} onChange={change(setDraw)} optional disabled={!canEdit}
              description="Leave it empty to ask every question." />
            <Input id="exam-time" label="Time limit (minutes)" type="number" inputMode="numeric" min={1} max={240} value={timeLimit} onChange={change(setTimeLimit)} optional disabled={!canEdit}
              description="Leave it empty for no time limit." />
          </div>
          <Switch id="exam-testout" label="Let people test out" description="They can sit the exam before the lessons. Passing it finishes the course. Best for refreshers." checked={testOut} onCheckedChange={change(setTestOut)} disabled={!canEdit} labelSpacing="spread" />
        </>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ui-border pt-4">
          <span className="text-sm text-ui-muted-foreground" role="status">{dirty ? "Unsaved changes" : "Saved to the draft"}</span>
          <Button type="button" className="min-h-11" disabled={pending || !dirty} onClick={save}><Check aria-hidden="true" />Save exam</Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-ui-border pt-4">
        <h3 className="font-semibold">How it has gone</h3>
        {report.sittings ? (
          <>
            <p className="text-sm tabular-nums">{report.sittings} {report.sittings === 1 ? "sitting" : "sittings"}, {report.passed} passed ({Math.round((report.passed / report.sittings) * 100)}%).</p>
            {missed.length ? (
              <>
                <p className="text-sm text-ui-muted-foreground">The questions people miss most. A question many people miss often means the lesson needs to explain it better.</p>
                <ol className="pc-rows">
                  {missed.map(({ q, stat, section }) => (
                    <li key={q.id} className="pc-row">
                      <span className="pc-row-body">
                        <span className="pc-row-title">{q.prompt}</span>
                        <span className="pc-row-hint">{section} · {missedLine(stat)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </>
        ) : <Notice title="Nobody has sat this exam yet">Results show here once people have.</Notice>}
      </div>
    </section>
  );
}
