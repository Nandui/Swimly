"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Frame } from "@/components/frame";
import { QuestionField, type Answer, type LearnerQuestion } from "@/components/question";
import { LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { date } from "@/lib/format";
import { EXAM_RESULT_META } from "@/lib/meta";

type Reviewed = LearnerQuestion & { yours: Answer | null; right: Answer; correct: boolean; explanation: string };
type Result = {
  number: number; submittedAt: string; correct: number; total: number; percent: number; passed: boolean; passMark: number | null;
  revisit: { id: string; title: string; firstLessonId: string | null }[];
  review: Reviewed[] | null;
};

/** The right answer in words, for the review after a pass. */
function rightInWords(q: Reviewed) {
  const text = new Map(q.options.map((o) => [o.id, o.text || "The picture"]));
  if (typeof q.right === "string") return text.get(q.right) ?? "";
  if (Array.isArray(q.right)) return q.right.map((id, i) => (q.kind === "ORDER" ? `${i + 1}. ` : "") + (text.get(id) ?? "")).join(q.kind === "ORDER" ? "  " : ", ");
  const partners = new Map(q.partners?.map((p) => [p.id, p.text]));
  return Object.entries(q.right).map(([left, right]) => `${text.get(left)} → ${partners.get(right)}`).join(", ");
}

/** One handed-in attempt. A pass shows every question with the right answer
 *  and why; a fail shows the score and which parts to go over again. */
export default function ExamResultPage() {
  const { id, attempt } = useParams<{ id: string; attempt: string }>();
  const { data, error, reload } = useLoad<Result>(`training/${id}/exam/attempts/${attempt}`);
  return (
    <Frame title="My training">
      <div className="stack">
        <Link href={`/training/${id}`} className="button ghost back-link"><ChevronLeft aria-hidden="true" />Course</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="pc-panel stack exam-score" aria-labelledby="result-title">
              <div className="row"><h1 id="result-title">{data.passed ? "You passed" : "Not this time"}</h1><Tag meta={EXAM_RESULT_META[data.passed ? "passed" : "failed"]} /></div>
              <p className="exam-figure tabular">{data.percent}%</p>
              <p className="muted tabular">{data.correct} of {data.total} right{data.passMark ? ` · pass mark ${data.passMark}%` : ""} · attempt {data.number}, {date(data.submittedAt)}</p>
              {data.passed
                ? <Link href={`/training/${id}`} className="button block">Back to the course<ChevronRight aria-hidden="true" /></Link>
                : null}
            </section>
            {!data.passed ? (
              <section className="pc-panel stack-sm" aria-labelledby="revisit-title">
                <h2 id="revisit-title">Go over these again</h2>
                <p className="muted">You got questions wrong from these parts of the course. Have another look, then try the exam again from the course page.</p>
                <ul className="pc-rows">
                  {data.revisit.map((s) => (
                    <li key={s.id}><Link href={s.firstLessonId ? `/training/${id}/${s.firstLessonId}` : `/training/${id}`} className="pc-row">
                      <span className="pc-row-body"><span className="pc-row-title">{s.title}</span></span><ChevronRight className="pc-row-chevron" aria-hidden="true" />
                    </Link></li>
                  ))}
                </ul>
                <Link href={`/training/${id}`} className="button outline block">Back to the course</Link>
              </section>
            ) : null}
            {data.review ? (
              <section className="stack" aria-labelledby="review-title">
                <h2 id="review-title">Your answers</h2>
                {data.review.map((q, i) => (
                  <article key={q.id} className="pc-panel stack-sm" aria-label={`Question ${i + 1}`}>
                    <QuestionField assignmentId={id} question={q} answer={q.yours} onChange={() => {}} locked number={`Question ${i + 1}`} />
                    {q.correct
                      ? <Notice title="You got this right">{q.explanation || undefined}</Notice>
                      : <Notice title={`The answer: ${rightInWords(q)}`} tone="warning">{q.explanation || undefined}</Notice>}
                  </article>
                ))}
              </section>
            ) : null}
          </>
        )}
      </div>
    </Frame>
  );
}
