"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { leftOf, topOf } from "@/components/ui-kit/scale";
import { apiFile } from "@/lib/api";

/** A question as Turnfin sends it: never which answer is right. */
export type QuestionKind = "SINGLE" | "MULTIPLE" | "TRUE_FALSE" | "ORDER" | "MATCH" | "FILL_BLANK" | "HOTSPOT" | "NUMBER" | "SHORT_ANSWER";
export type LearnerQuestion = {
  id: string; kind: QuestionKind; prompt: string; imageId: string | null;
  options: { id: string; text: string; imageId: string | null }[];
  partners: { id: string; text: string }[] | null;
  /** Fill in the blanks: the sentence around the blanks (one more piece than blanks). */
  segments: string[] | null;
};

/** A course's final exam as Turnfin Me sees it: the rules and past attempts, never the questions. */
export type ExamInfo = {
  questions: number; passMark: number; timeLimit: number | null; testOut: boolean; attempts: { allowed: number; used: number; left: number };
  passed: boolean; lessonsDone: boolean; canStart: boolean; reason: string | null;
  open: { id: string; number: number; deadlineAt: string | null; answered: number; total: number } | null;
  history: { number: number; submittedAt: string; correct: number; total: number; percent: number; passed: boolean }[];
};

/** One option id, several (several answers, an order) or pairs (match). */
export type Answer = string | string[] | Record<string, string>;

export const QUESTION_HINT: Record<QuestionKind, string> = {
  SINGLE: "Choose one answer.",
  MULTIPLE: "Choose every right answer.",
  TRUE_FALSE: "True or false?",
  ORDER: "Put these in the right order.",
  MATCH: "Match each one to its partner.",
  FILL_BLANK: "Type the missing words.",
  HOTSPOT: "Tap the right place on the picture.",
  NUMBER: "Type the number.",
  SHORT_ANSWER: "Type your answer.",
};

/** A typed number, with a full stop or a comma. */
export const isNumber = (value: unknown) => typeof value === "string" && /^-?\d{1,9}(?:[.,]\d{1,6})?$/.test(value.trim().replace(/\s+/g, ""));

/** A tapped spot, "x,y" in percent of the picture, and back. */
export const spotText = (x: number, y: number) => `${Math.round(Math.min(100, Math.max(0, x)) * 10) / 10},${Math.round(Math.min(100, Math.max(0, y)) * 10) / 10}`;
export function readSpot(value: unknown) {
  const match = typeof value === "string" ? /^(\d{1,3}(?:\.\d)?),(\d{1,3}(?:\.\d)?)$/.exec(value) : null;
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

/** Whether the learner has given an answer they could hand in. */
export function answered(question: LearnerQuestion, answer: Answer | null | undefined) {
  if (answer == null) return false;
  if (question.kind === "SINGLE" || question.kind === "TRUE_FALSE") return typeof answer === "string" && !!answer;
  if (question.kind === "HOTSPOT") return !!readSpot(answer);
  if (question.kind === "NUMBER") return isNumber(answer);
  if (question.kind === "SHORT_ANSWER") return typeof answer === "string" && !!answer.trim();
  if (question.kind === "FILL_BLANK") return typeof answer === "object" && !Array.isArray(answer) && question.options.every((o) => !!answer[o.id]?.trim());
  if (question.kind === "MULTIPLE") return Array.isArray(answer) && answer.length > 0;
  if (question.kind === "ORDER") return Array.isArray(answer) && answer.length === question.options.length;
  return typeof answer === "object" && !Array.isArray(answer) && question.options.every((o) => !!answer[o.id]);
}

/** A picture from the person's own course, fetched with their sign-in. `path`
 *  fetches another picture they may see, such as a catalogue course's cover. */
export function CourseImage({ assignmentId, fileId, alt, className, path }: { assignmentId: string; fileId: string; alt: string; className?: string; path?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let local: string | null = null, live = true;
    apiFile(path ?? `training/${assignmentId}/files/${fileId}`)
      .then((blob) => { if (live) { local = URL.createObjectURL(blob); setUrl(local); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [assignmentId, fileId, path]);
  if (failed) return <span className="caption">This picture didn’t load.</span>;
  // eslint-disable-next-line @next/next/no-img-element -- a private image from the staff API
  return url ? <img className={className ?? "question-image"} src={url} alt={alt} /> : <span className="lesson-image-placeholder" role="img" aria-label="Loading picture" />;
}

/** Pick the spot: tap (or move with the arrow keys) to put a marker on the picture. */
function SpotField({ assignmentId, question, answer, onChange, locked, right }: {
  assignmentId: string; question: LearnerQuestion; answer: Answer | null; onChange: (answer: Answer | null) => void; locked?: boolean; right?: string | null;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const spot = readSpot(answer), mark = readSpot(right);
  function place(event: PointerEvent<HTMLDivElement>) {
    if (locked || !frame.current) return;
    const box = frame.current.getBoundingClientRect();
    onChange(spotText(((event.clientX - box.left) / box.width) * 100, ((event.clientY - box.top) / box.height) * 100));
  }
  function nudge(event: KeyboardEvent<HTMLDivElement>) {
    if (locked) return;
    const step = event.shiftKey ? 10 : 2;
    const at = spot ?? { x: 50, y: 50 };
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const by = moves[event.key];
    if (by) { event.preventDefault(); onChange(spotText(at.x + by[0], at.y + by[1])); }
    else if ((event.key === "Enter" || event.key === " ") && !spot) { event.preventDefault(); onChange(spotText(50, 50)); }
  }
  if (!question.imageId) return null;
  return (
    <div ref={frame} className="spot-frame" data-locked={locked || undefined} onPointerDown={place} onKeyDown={nudge} tabIndex={locked ? -1 : 0} role="application"
      aria-label={`Picture. ${spot ? `Your marker is ${Math.round(spot.x)}% from the left and ${Math.round(spot.y)}% from the top.` : "No marker yet."} Tap the right place, or press Enter and move the marker with the arrow keys.`}>
      <CourseImage assignmentId={assignmentId} fileId={question.imageId} alt="" className="spot-image" />
      {spot ? <span className={`spot-marker ${leftOf(spot.x / 100)} ${topOf(spot.y / 100)}`} aria-hidden="true" /> : null}
      {mark ? <span className={`spot-marker is-right ${leftOf(mark.x / 100)} ${topOf(mark.y / 100)}`} aria-hidden="true" /> : null}
    </div>
  );
}

/** One question to answer. The parent owns the answer; `locked` shows it without letting it change.
 *  `right` (Pick the spot, in a review) also marks where the right place was. */
export function QuestionField({ assignmentId, question, answer, onChange, locked, number, right }: {
  assignmentId: string; question: LearnerQuestion; answer: Answer | null; onChange: (answer: Answer | null) => void; locked?: boolean; number?: string; right?: Answer | null;
}) {
  const name = `q-${question.id}`;
  const legend = (
    <legend className="question-prompt">
      {number ? <span className="caption tabular-nums">{number}</span> : null}
      <span>{question.prompt}</span>
      <span className="caption">{QUESTION_HINT[question.kind]}</span>
    </legend>
  );
  const picture = question.imageId ? <CourseImage assignmentId={assignmentId} fileId={question.imageId} alt="Picture for this question" /> : null;

  if (question.kind === "HOTSPOT") {
    return (
      <fieldset className="question" disabled={locked}>
        {legend}
        <SpotField assignmentId={assignmentId} question={question} answer={answer} onChange={onChange} locked={locked} right={typeof right === "string" ? right : null} />
      </fieldset>
    );
  }

  if (question.kind === "NUMBER" || question.kind === "SHORT_ANSWER") {
    const value = typeof answer === "string" ? answer : "";
    const unit = question.kind === "NUMBER" ? question.options[0]?.text ?? "" : "";
    return (
      <fieldset className="question" disabled={locked}>
        {legend}
        {picture}
        <div className="typed-answer">
          <Input id={`${name}-typed`} aria-label={question.kind === "NUMBER" ? `Your answer${unit ? ` in ${unit}` : ""}` : "Your answer"} value={value} disabled={locked}
            inputMode={question.kind === "NUMBER" ? "decimal" : "text"} maxLength={question.kind === "NUMBER" ? 20 : 200} autoComplete="off" autoCapitalize={question.kind === "NUMBER" ? "off" : "sentences"}
            onChange={(e) => onChange(e.target.value ? e.target.value : null)} />
          {unit ? <span className="typed-unit" aria-hidden="true">{unit}</span> : null}
        </div>
        {question.kind === "NUMBER" && value && !isNumber(value) ? <p className="caption">Use only digits, such as 1.5.</p> : null}
      </fieldset>
    );
  }

  if (question.kind === "FILL_BLANK") {
    const typed = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
    const segments = question.segments ?? [question.prompt];
    return (
      <fieldset className="question" disabled={locked}>
        <legend className="question-prompt">
          {number ? <span className="caption tabular-nums">{number}</span> : null}
          <span className="sr-only">{question.prompt}</span>
          <span className="caption">{QUESTION_HINT.FILL_BLANK}</span>
        </legend>
        {picture}
        <p className="blank-sentence">
          {segments.map((text, i) => (
            <span key={i}>
              {text}
              {question.options[i] ? (
                <Input className="blank-input" aria-label={`Blank ${i + 1} of ${question.options.length}`} value={typed[question.options[i].id] ?? ""} disabled={locked} maxLength={64}
                  autoCapitalize="off" autoComplete="off" spellCheck={false}
                  onChange={(e) => {
                    const next = { ...typed, [question.options[i].id]: e.target.value };
                    if (!e.target.value) delete next[question.options[i].id];
                    onChange(Object.keys(next).length ? next : null);
                  }} />
              ) : null}
            </span>
          ))}
        </p>
      </fieldset>
    );
  }

  if (question.kind === "ORDER") {
    const order = Array.isArray(answer) && answer.length === question.options.length ? answer : question.options.map((o) => o.id);
    const byId = new Map(question.options.map((o) => [o.id, o]));
    const move = (from: number, to: number) => {
      const next = [...order];
      [next[from], next[to]] = [next[to], next[from]];
      onChange(next);
    };
    return (
      <fieldset className="question" disabled={locked}>
        {legend}
        {picture}
        <ol className="choices">
          {order.map((id, i) => (
            <li key={id} className="choice order-step">
              <span className="order-number tabular-nums" aria-hidden="true">{i + 1}</span>
              <span className="choice-text">{byId.get(id)?.text}</span>
              {locked ? null : <span className="order-moves">
                <Button type="button" variant="ghost" size="icon" onClick={() => move(i, i - 1)} disabled={locked || i === 0} aria-label={`Move “${byId.get(id)?.text}” up`}><ArrowUp aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => move(i, i + 1)} disabled={locked || i === order.length - 1} aria-label={`Move “${byId.get(id)?.text}” down`}><ArrowDown aria-hidden="true" /></Button>
              </span>}
            </li>
          ))}
        </ol>
        {!locked && !Array.isArray(answer) ? (
          <Button type="button" variant="outline" className="self-start max-md:self-stretch" onClick={() => onChange(order)}>This order is right</Button>
        ) : null}
      </fieldset>
    );
  }

  if (question.kind === "MATCH") {
    const pairs = answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
    return (
      <fieldset className="question" disabled={locked}>
        {legend}
        {picture}
        <ul className="choices">
          {question.options.map((o) => (
            <li key={o.id} className="choice match-pair">
              <Label htmlFor={`${name}-${o.id}`} className="choice-text">{o.text}</Label>
              <NativeSelect id={`${name}-${o.id}`} value={pairs[o.id] ?? ""} disabled={locked}
                onChange={(e) => {
                  const next = { ...pairs };
                  if (e.target.value) next[o.id] = e.target.value; else delete next[o.id];
                  onChange(Object.keys(next).length ? next : null);
                }}>
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                {question.partners?.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.text}</NativeSelectOption>)}
              </NativeSelect>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  }

  const several = question.kind === "MULTIPLE";
  const chosen = new Set(several ? (Array.isArray(answer) ? answer : []) : typeof answer === "string" ? [answer] : []);
  const optionText = (o: LearnerQuestion["options"][number]) => (
    <span className="choice-text">
      {o.imageId ? <CourseImage assignmentId={assignmentId} fileId={o.imageId} alt={o.text || "Answer picture"} className="choice-image" /> : null}
      {o.text}
    </span>
  );
  return (
    <fieldset className="question" disabled={locked}>
      {legend}
      {picture}
      {several ? (
        <ul className="choices">
          {question.options.map((o) => (
            <li key={o.id}>
              <Label className="choice selectable">
                <Checkbox name={name} value={o.id} checked={chosen.has(o.id)} disabled={locked}
                  onCheckedChange={(checked) => {
                    const next = new Set(chosen);
                    if (checked === true) next.add(o.id); else next.delete(o.id);
                    onChange(next.size ? [...next] : null);
                  }} />
                {optionText(o)}
              </Label>
            </li>
          ))}
        </ul>
      ) : (
        <RadioGroup className="choices" name={name} value={typeof answer === "string" ? answer : ""} disabled={locked} onValueChange={(value) => onChange(value)}>
          {question.options.map((o) => (
            <Label key={o.id} className="choice selectable">
              <RadioGroupItem value={o.id} />
              {optionText(o)}
            </Label>
          ))}
        </RadioGroup>
      )}
    </fieldset>
  );
}
