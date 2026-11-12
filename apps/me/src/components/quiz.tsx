"use client";

import { useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Bar, Notice } from "@/components/ui";
import { answered, QuestionField, type Answer, type LearnerQuestion } from "@/components/question";
import { ApiError, api } from "@/lib/api";

type Checked = { correct: boolean; explanation: string };

/** A Quiz lesson: practice questions one at a time. Turnfin checks each answer
 *  and says right or not; the explanation comes with a right answer, or when
 *  the learner asks to see why. Nothing here is marked or kept. */
export function QuizRunner({ assignmentId, lessonId, questions, onFinished }: {
  assignmentId: string; lessonId: string; questions: LearnerQuestion[]; onFinished: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [tries, setTries] = useState(0);
  const [firstTime, setFirstTime] = useState(0);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const question = questions[index];

  async function check(giveUp: boolean) {
    setBusy(true); setFailure(null);
    try {
      const result = await api<Checked>(`training/${assignmentId}/lessons/${lessonId}/check`, { method: "POST", body: { questionId: question.id, answer, giveUp } });
      setChecked(result);
      if (giveUp) setGaveUp(true);
      else { if (result.correct && tries === 0) setFirstTime((n) => n + 1); setTries((n) => n + 1); }
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : "That didn't check. Try again.");
    } finally { setBusy(false); }
  }
  function next() {
    setAnswer(null); setChecked(null); setGaveUp(false); setTries(0);
    if (index + 1 < questions.length) setIndex(index + 1);
    else { setFinished(true); onFinished(); }
  }
  function again() {
    setIndex(0); setFirstTime(0); setFinished(false); setAnswer(null); setChecked(null); setGaveUp(false); setTries(0);
  }

  if (!questions.length) return <Notice title="No questions here yet">Carry on to the next lesson.</Notice>;
  if (finished) {
    return (
      <section className="pc-panel quiz-done" aria-labelledby="quiz-done-title">
        <h2 id="quiz-done-title" role="status">You got {firstTime} of {questions.length} right first time</h2>
        <p className="text-ui-muted-foreground">{firstTime === questions.length ? "Spot on. You're ready to move on." : "Have another go if you like, or carry on. Practice is never marked."}</p>
        <Button type="button" variant="outline" className="self-start max-md:self-stretch" onClick={again}><RotateCcw aria-hidden="true" />Practise again</Button>
      </section>
    );
  }
  const settled = !!checked && (checked.correct || gaveUp);
  return (
    <section className="pc-panel" aria-label={`Practice question ${index + 1} of ${questions.length}`}>
      <Bar max={questions.length} value={index + (settled ? 1 : 0)} label="Through the questions" />
      <QuestionField key={question.id} assignmentId={assignmentId} question={question} answer={answer} number={`Question ${index + 1} of ${questions.length}`}
        onChange={(value) => { setAnswer(value); if (checked && !settled) setChecked(null); }} locked={settled || busy} />
      {checked ? (
        checked.correct
          ? <Notice title="That's right" live>{checked.explanation || undefined}</Notice>
          : gaveUp
            ? <Notice title="Not quite. Here's why" tone="warning" live>{checked.explanation || "Go back over this part of the lesson."}</Notice>
            : <Notice title="Not quite" tone="warning" live>Change your answer and check again, or see why.</Notice>
      ) : null}
      {failure ? <Notice title={failure} tone="error" live /> : null}
      <div className="lesson-nav">
        {checked && !settled ? <Button type="button" variant="outline" onClick={() => check(true)} disabled={busy}>Show me why</Button> : <span />}
        {settled
          ? <Button type="button" onClick={next}>{index + 1 < questions.length ? "Next question" : "See how I did"}<ChevronRight aria-hidden="true" /></Button>
          : <Button type="button" onClick={() => check(false)} disabled={busy || !answered(question, answer)}>{busy ? "Checking…" : "Check"}</Button>}
      </div>
    </section>
  );
}
