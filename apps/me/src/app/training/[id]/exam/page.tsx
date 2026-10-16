"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, Clock3, Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { answered, QuestionField, type Answer, type ExamInfo, type LearnerQuestion } from "@/components/question";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

type Paper = { id: string; number: number; deadlineAt: string | null; questions: (LearnerQuestion & { answer: Answer | null })[] };
type Exam = ExamInfo & { paper: Paper | null };
type Saving = "idle" | "saving" | "saved" | "failed";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Time left on a timed paper. Announced at five minutes and one minute, never every second. */
function Timer({ deadline, onOut }: { deadline: string; onOut: () => void }) {
  const end = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const left = end - now;
  useEffect(() => { if (left <= 0 && !fired.current) { fired.current = true; onOut(); } }, [left, onOut]);
  const minutes = Math.ceil(left / 60_000);
  return (
    <div className={`exam-timer tabular${left < 60_000 ? " is-low" : ""}`}>
      <Clock3 aria-hidden="true" /><span role="timer" aria-label="Time left">{clock(left)}</span>
      <span className="sr-only" role="status">{minutes === 5 ? "Five minutes left." : minutes === 1 ? "One minute left." : ""}</span>
    </div>
  );
}

/** The final exam: rules first, then one question per screen with every answer
 *  saved as it is given, a review of what's left, and handing in. Turnfin marks
 *  it; the right answers never come to the phone before a pass. */
export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, setData, error, reload } = useLoad<Exam>(`training/${id}/exam`);
  const [index, setIndex] = useState(0);
  // Answers given on this screen; anything else comes from what Turnfin saved.
  const [given, setGiven] = useState<Record<string, Answer | null>>({});
  const [saving, setSaving] = useState<Saving>("idle");
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const paper = data?.paper ?? null;
  const answers: Record<string, Answer | null> = { ...Object.fromEntries(paper?.questions.map((q) => [q.id, q.answer]) ?? []), ...given };

  async function start() {
    setBusy(true); setFailure(null);
    try { setData(await api<Exam>(`training/${id}/exam/start`, { method: "POST" })); setIndex(0); setReviewing(false); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "The exam didn't start. Try again."); }
    finally { setBusy(false); }
  }

  function answer(questionId: string, value: Answer | null) {
    if (!paper) return;
    setGiven((prev) => ({ ...prev, [questionId]: value }));
    setSaving("saving");
    // One save at a time, in order, so the last answer given is the one kept.
    queue.current = queue.current.then(() => api(`training/${id}/exam/answers`, { method: "PUT", body: { attemptId: paper.id, questionId, answer: value } })
      .then(() => setSaving("saved"))
      .catch((caught) => { setSaving("failed"); if (caught instanceof ApiError && caught.status === 409) setFailure(caught.message); }));
  }

  const handIn = useCallback(async () => {
    if (!paper) return;
    setBusy(true); setFailure(null);
    try {
      await queue.current;
      const { number } = await api<{ number: number | null }>(`training/${id}/exam/submit`, { method: "POST", body: { attemptId: paper.id } });
      router.replace(`/training/${id}/exam/${number ?? paper.number}`);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : "That didn't hand in. Check your connection and try again.");
      setBusy(false);
    }
  }, [id, paper, router]);

  const question = paper?.questions[index] ?? null;
  const done = paper ? paper.questions.filter((q) => answered(q, answers[q.id])).length : 0;
  const unanswered = paper ? paper.questions.map((q, i) => ({ q, i })).filter(({ q }) => !answered(q, answers[q.id])) : [];

  return (
    <Frame title="My training">
      <div className="stack">
        <Link href={`/training/${id}`} className="button ghost back-link"><ChevronLeft aria-hidden="true" />Course</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : !paper ? (
          <section className="pc-panel stack" aria-labelledby="exam-title">
            <div className="stack-sm">
              <h1 id="exam-title">Final exam</h1>
              <p className="muted">{data.passed ? "You have passed this exam." : data.attempts.used ? `Attempt ${data.attempts.used + 1} of ${data.attempts.allowed}.` : "Take your time and read each question carefully."}</p>
            </div>
            <ul className="exam-rules">
              <li><strong className="tabular">{data.questions}</strong> questions{data.questions > 1 ? ", one per screen" : ""}</li>
              <li>Pass mark <strong className="tabular">{data.passMark}%</strong></li>
              <li>{data.timeLimit ? <><strong className="tabular">{data.timeLimit} minutes</strong> once you start. The clock keeps going if you leave.</> : "No time limit"}</li>
              <li>Your answers save as you go. You can go back and change them until you hand in.</li>
              <li><strong className="tabular">{data.attempts.left}</strong> {data.attempts.left === 1 ? "attempt" : "attempts"} left</li>
            </ul>
            {failure ? <Notice title={failure} tone="error" live /> : null}
            {data.canStart
              ? <button type="button" className="button block" onClick={start} disabled={busy}>{busy ? "Starting…" : "Start the exam"}<ChevronRight aria-hidden="true" /></button>
              : <Notice title={data.reason ?? "The exam isn't open."} />}
          </section>
        ) : reviewing ? (
          <section className="pc-panel stack" aria-labelledby="review-title">
            <div className="stack-sm">
              <h1 id="review-title">Ready to hand in?</h1>
              <p className="muted tabular">{done} of {paper.questions.length} answered</p>
              <progress className="course-progress" max={paper.questions.length} value={done} aria-label="Questions answered" />
            </div>
            {unanswered.length ? (
              <Notice title={unanswered.length === 1 ? "One question has no answer" : `${unanswered.length} questions have no answer`} tone="warning">
                An unanswered question counts as wrong.
              </Notice>
            ) : <Notice title="Every question has an answer" />}
            {unanswered.length ? (
              <ul className="pc-rows">
                {unanswered.map(({ q, i }) => (
                  <li key={q.id}><button type="button" className="pc-row exam-jump" onClick={() => { setIndex(i); setReviewing(false); setConfirming(false); }}>
                    <span className="pc-row-body"><span className="pc-row-title">Question {i + 1}</span><span className="pc-row-hint">{q.prompt}</span></span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </button></li>
                ))}
              </ul>
            ) : null}
            {paper.deadlineAt ? <Timer deadline={paper.deadlineAt} onOut={handIn} /> : null}
            {failure ? <Notice title={failure} tone="error" live /> : null}
            <div className="lesson-nav">
              <button type="button" className="button outline" onClick={() => { setReviewing(false); setConfirming(false); }}><ChevronLeft aria-hidden="true" />Back to the questions</button>
              {confirming
                ? <button type="button" className="button" onClick={handIn} disabled={busy}><Send aria-hidden="true" />{busy ? "Handing in…" : "Yes, hand it in"}</button>
                : <button type="button" className="button" onClick={() => setConfirming(true)}><CircleCheck aria-hidden="true" />Hand in</button>}
            </div>
            {confirming ? <p className="caption" role="status">You can&apos;t change your answers after this.</p> : null}
          </section>
        ) : question ? (
          <section className="stack" aria-labelledby="exam-question-title">
            <h1 id="exam-question-title">Final exam</h1>
            <div className="exam-bar">
              <span className="caption tabular exam-count">Question {index + 1} of {paper.questions.length}</span>
              <span className="caption muted exam-saved">{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}</span>
              {paper.deadlineAt ? <Timer deadline={paper.deadlineAt} onOut={handIn} /> : null}
            </div>
            <nav aria-label="Questions" className="exam-dots">
              {paper.questions.map((q, i) => (
                <button key={q.id} type="button" className="exam-dot tabular" data-answered={answered(q, answers[q.id]) || undefined} aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${i + 1}${answered(q, answers[q.id]) ? ", answered" : ""}`} onClick={() => setIndex(i)}>{i + 1}</button>
              ))}
            </nav>
            <div className="pc-panel">
              <QuestionField key={question.id} assignmentId={id} question={question} answer={answers[question.id] ?? null} onChange={(value) => answer(question.id, value)} locked={busy} />
            </div>
            {saving === "failed" && !failure ? <Notice title="Your last answer didn't save" tone="error" live>Check your connection, then choose it again.</Notice> : null}
            {failure ? <Notice title={failure} tone="error" live /> : null}
            <div className="lesson-nav">
              {index > 0 ? <button type="button" className="button outline" onClick={() => setIndex(index - 1)}><ChevronLeft aria-hidden="true" />Back</button> : <span />}
              {index + 1 < paper.questions.length
                ? <button type="button" className="button" onClick={() => setIndex(index + 1)}>Next question<ChevronRight aria-hidden="true" /></button>
                : <button type="button" className="button" onClick={() => setReviewing(true)}>Review and hand in<ChevronRight aria-hidden="true" /></button>}
            </div>
          </section>
        ) : null}
      </div>
    </Frame>
  );
}
