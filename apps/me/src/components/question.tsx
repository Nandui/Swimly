"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { apiFile } from "@/lib/api";

/** A question as Turnfin sends it: never which answer is right. */
export type QuestionKind = "SINGLE" | "MULTIPLE" | "TRUE_FALSE" | "ORDER" | "MATCH";
export type LearnerQuestion = {
  id: string; kind: QuestionKind; prompt: string; imageId: string | null;
  options: { id: string; text: string; imageId: string | null }[];
  partners: { id: string; text: string }[] | null;
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
};

/** Whether the learner has given an answer they could hand in. */
export function answered(question: LearnerQuestion, answer: Answer | null | undefined) {
  if (answer == null) return false;
  if (question.kind === "SINGLE" || question.kind === "TRUE_FALSE") return typeof answer === "string" && !!answer;
  if (question.kind === "MULTIPLE") return Array.isArray(answer) && answer.length > 0;
  if (question.kind === "ORDER") return Array.isArray(answer) && answer.length === question.options.length;
  return typeof answer === "object" && !Array.isArray(answer) && question.options.every((o) => !!answer[o.id]);
}

/** A picture from the person's own course, fetched with their sign-in. */
export function CourseImage({ assignmentId, fileId, alt, className }: { assignmentId: string; fileId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let local: string | null = null, live = true;
    apiFile(`training/${assignmentId}/files/${fileId}`)
      .then((blob) => { if (live) { local = URL.createObjectURL(blob); setUrl(local); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [assignmentId, fileId]);
  if (failed) return <span className="caption muted">This picture didn’t load.</span>;
  // eslint-disable-next-line @next/next/no-img-element -- a private image from the staff API
  return url ? <img className={className ?? "question-image"} src={url} alt={alt} /> : <span className="lesson-image-placeholder" role="img" aria-label="Loading picture" />;
}

/** One question to answer. The parent owns the answer; `locked` shows it without letting it change. */
export function QuestionField({ assignmentId, question, answer, onChange, locked, number }: {
  assignmentId: string; question: LearnerQuestion; answer: Answer | null; onChange: (answer: Answer | null) => void; locked?: boolean; number?: string;
}) {
  const name = `q-${question.id}`;
  const legend = (
    <legend className="question-prompt">
      {number ? <span className="caption muted tabular">{number}</span> : null}
      <span>{question.prompt}</span>
      <span className="caption muted">{QUESTION_HINT[question.kind]}</span>
    </legend>
  );
  const picture = question.imageId ? <CourseImage assignmentId={assignmentId} fileId={question.imageId} alt="Picture for this question" /> : null;

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
              <span className="order-number tabular" aria-hidden="true">{i + 1}</span>
              <span className="choice-text">{byId.get(id)?.text}</span>
              {locked ? null : <span className="order-moves">
                <button type="button" className="button ghost icon" onClick={() => move(i, i - 1)} disabled={locked || i === 0} aria-label={`Move “${byId.get(id)?.text}” up`}><ArrowUp aria-hidden="true" /></button>
                <button type="button" className="button ghost icon" onClick={() => move(i, i + 1)} disabled={locked || i === order.length - 1} aria-label={`Move “${byId.get(id)?.text}” down`}><ArrowDown aria-hidden="true" /></button>
              </span>}
            </li>
          ))}
        </ol>
        {!locked && !Array.isArray(answer) ? (
          <button type="button" className="button outline block" onClick={() => onChange(order)}>This order is right</button>
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
              <label htmlFor={`${name}-${o.id}`} className="choice-text">{o.text}</label>
              <select id={`${name}-${o.id}`} className="input" value={pairs[o.id] ?? ""} disabled={locked}
                onChange={(e) => {
                  const next = { ...pairs };
                  if (e.target.value) next[o.id] = e.target.value; else delete next[o.id];
                  onChange(Object.keys(next).length ? next : null);
                }}>
                <option value="">Choose…</option>
                {question.partners?.map((p) => <option key={p.id} value={p.id}>{p.text}</option>)}
              </select>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  }

  const several = question.kind === "MULTIPLE";
  const chosen = new Set(several ? (Array.isArray(answer) ? answer : []) : typeof answer === "string" ? [answer] : []);
  return (
    <fieldset className="question" disabled={locked}>
      {legend}
      {picture}
      <ul className="choices">
        {question.options.map((o) => (
          <li key={o.id}>
            <label className="choice selectable">
              <input type={several ? "checkbox" : "radio"} name={name} value={o.id} checked={chosen.has(o.id)} disabled={locked}
                onChange={(e) => {
                  if (!several) { onChange(o.id); return; }
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(o.id); else next.delete(o.id);
                  onChange(next.size ? [...next] : null);
                }} />
              <span className="choice-text">
                {o.imageId ? <CourseImage assignmentId={assignmentId} fileId={o.imageId} alt={o.text || "Answer picture"} className="choice-image" /> : null}
                {o.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
