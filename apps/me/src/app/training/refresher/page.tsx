"use client";

import { useState } from "react";
import { Award, BookCheck, ChevronRight, Clock, Flame, GraduationCap, Medal, Route, Sparkles, Star, Target, Trophy } from "lucide-react";
import { Frame } from "@/components/frame";
import { answered, QuestionField, type Answer, type LearnerQuestion } from "@/components/question";
import { LoadError, Loading, Notice, Section, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

type Item = { cardId: string | null; assignmentId: string; course: string; question: LearnerQuestion & { id: string } };
type Badge = { id: string; title: string; hint: string; earned: boolean };
type Refresher = {
  on: string; goal: number; answered: number; correct: number; streak: { current: number; best: number; today: boolean };
  questions: Item[]; badges: Badge[];
};
type Checked = { done: boolean; correct: boolean | null; explanation: string; nextIn: number | null };

const BADGE_ICON: Record<string, typeof Award> = {
  "first-course": GraduationCap, "five-courses": BookCheck, "ten-courses": Trophy, "first-time": Target, "full-marks": Star,
  "streak-3": Flame, "streak-7": Flame, "streak-30": Flame, "refresher-50": Sparkles, "hours-met": Clock, "path-done": Route,
};

function Badges({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <Section id="badges-title" title="Badges" aside={<p>{earned} of {badges.length}</p>}>
      <div className="pc-panel">
      <ul className="badges">
        {badges.map((b) => {
          const Icon = BADGE_ICON[b.id] ?? Medal;
          return (
            <li key={b.id} className="badge" data-earned={b.earned || undefined}>
              <span className="badge-icon"><Icon aria-hidden="true" /></span>
              <strong>{b.title}</strong>
              <span className="caption">{b.earned ? "Earned" : b.hint}</span>
            </li>
          );
        })}
      </ul>
      </div>
    </Section>
  );
}

/** Today's two-minute refresher (Training e-learning phase 6): questions you
 *  missed come back, further apart each time you get them right. Your streak
 *  counts days you learned something, and badges mark the milestones. */
export default function RefresherPage() {
  const { data, error, reload } = useLoad<Refresher>("training/refresher");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [tally, setTally] = useState({ answered: 0, correct: 0 });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const item = data?.questions[index] ?? null;
  async function check() {
    if (!item) return;
    setBusy(true); setFailure(null);
    try {
      const result = await api<Checked>("training/refresher/answer", { method: "POST", body: item.cardId ? { cardId: item.cardId, answer } : { assignmentId: item.assignmentId, questionId: item.question.id, answer } });
      setChecked(result);
      if (!result.done) setTally((t) => ({ answered: t.answered + 1, correct: t.correct + (result.correct ? 1 : 0) }));
    } catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't check. Try again."); }
    finally { setBusy(false); }
  }
  function next() { setAnswer(null); setChecked(null); setIndex((i) => i + 1); }
  const answeredToday = (data?.answered ?? 0) + tally.answered;
  const finished = !!data && (index >= data.questions.length);
  const streak = data ? (data.streak.today || tally.answered === 0 ? data.streak.current : data.streak.current + 1) : 0;
  return (
    <Frame title="Today’s refresher">
      <PageShell header={<PageHeader back={{ href: "/training", label: "My training" }} title="Today’s refresher" description="A few questions from your courses, about two minutes. The ones you miss come back until they stick." />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="pc-panel refresher-head" aria-label="Your streak">
              <span className="streak" data-cold={streak === 0 || undefined}><Flame aria-hidden="true" /><span className="streak-figure">{streak}</span>{streak === 1 ? "day in a row" : "days in a row"}</span>
              <span className="stack-sm">
                <span className="day-dots" aria-label={`${Math.min(answeredToday, data.goal)} of ${data.goal} answered today`}>
                  {Array.from({ length: data.goal }, (_, i) => <span key={i} className="day-dot" data-done={i < answeredToday || undefined} />)}
                </span>
                <span className="caption tabular-nums">Best {Math.max(data.streak.best, streak)} {Math.max(data.streak.best, streak) === 1 ? "day" : "days"}</span>
              </span>
            </section>
            {finished ? (
              <section className="pc-panel quiz-done" aria-labelledby="refresher-done">
                <h2 id="refresher-done" role={tally.answered ? "status" : undefined}>
                  {tally.answered ? `You got ${tally.correct} of ${tally.answered} right` : data.answered ? "Done for today" : "Nothing to refresh yet"}
                </h2>
                <p className="text-ui-muted-foreground">
                  {tally.answered || data.answered ? "Come back tomorrow to keep your streak going. Anything you missed comes back then."
                    : "Questions you miss in a course’s practice come back here, along with questions from courses you have finished."}
                </p>
              </section>
            ) : item ? (
              <section className="pc-panel stack" aria-label={`Refresher question ${index + 1} of ${data.questions.length}`}>
                <p className="caption eyebrow">{item.course}</p>
                <QuestionField key={item.question.id} assignmentId={item.assignmentId} question={item.question} answer={answer} number={`Question ${index + 1} of ${data.questions.length}`}
                  onChange={setAnswer} locked={!!checked || busy} />
                {checked?.done ? <Notice title="Already answered today" live>Carry on with the next one.</Notice>
                  : checked ? (checked.correct
                    ? <Notice title="That’s right" live>{[checked.explanation, checked.nextIn ? `You’ll see it again in ${checked.nextIn} ${checked.nextIn === 1 ? "day" : "days"}.` : null].filter(Boolean).join(" ")}</Notice>
                    : <Notice title="Not quite" tone="warning" live>{[checked.explanation || "Go back over this part of the course.", "It comes back tomorrow."].join(" ")}</Notice>)
                  : null}
                {failure ? <Notice title={failure} tone="error" live /> : null}
                <div className="lesson-nav">
                  <span />
                  {checked
                    ? <Button type="button" onClick={next}>{index + 1 < data.questions.length ? "Next question" : "Finish"}<ChevronRight aria-hidden="true" /></Button>
                    : <Button type="button" onClick={check} disabled={busy || !answered(item.question, answer)}>{busy ? "Checking…" : "Check"}</Button>}
                </div>
              </section>
            ) : null}
            <Badges badges={data.badges} />
          </>
        )}
      </PageShell>
    </Frame>
  );
}
