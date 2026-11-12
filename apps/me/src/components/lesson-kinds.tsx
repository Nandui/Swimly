"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, RotateCcw, RotateCw, ThumbsUp, Undo2 } from "lucide-react";
import { CourseImage } from "@/components/question";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Label } from "@/components/shadcn/label";
import { Bar, Notice } from "@/components/ui";
import { apiFile } from "@/lib/api";

/** Lessons that aren't text (Training e-learning phase 3): a branching
 *  scenario, flashcards, a checklist and a recording. Each tells the lesson
 *  page when the learner has done enough to carry on. Practice: nothing here
 *  is marked or kept beyond finishing the lesson. */

export type Scene = { id: string; text: string; imageId: string | null; choices: { id: string; text: string; feedback: string; next: string | null; best: boolean }[] };
export type Card = { id: string; front: string; back: string; imageId: string | null };
export type Item = { id: string; text: string };

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

/** One scene at a time. A choice shows what happened, then goes on or ends.
 *  The best ending finishes the lesson; any other can be tried again. */
export function ScenarioPlayer({ assignmentId, steps, onFinished }: { assignmentId: string; steps: Scene[]; onFinished: () => void }) {
  const [at, setAt] = useState(steps[0]?.id ?? "");
  const [picked, setPicked] = useState<Scene["choices"][number] | null>(null);
  const scene = steps.find((s) => s.id === at);
  if (!scene) return <Notice title="This scenario has no scenes yet" />;
  const ended = !!picked && !picked.next;
  function choose(choice: Scene["choices"][number]) {
    setPicked(choice);
    if (!choice.next && choice.best) onFinished();
  }
  function carryOn() { if (picked?.next) { setAt(picked.next); setPicked(null); } }
  function restart() { setAt(steps[0].id); setPicked(null); }
  const number = steps.findIndex((s) => s.id === scene.id) + 1;
  return (
    <section className="pc-panel stack scenario" aria-labelledby="scene-title" aria-live="polite">
      <p className="caption tabular" id="scene-title">Scene {number} of {steps.length}</p>
      {scene.imageId ? <CourseImage assignmentId={assignmentId} fileId={scene.imageId} alt="" className="question-image" /> : null}
      <p className="scene-text">{scene.text}</p>
      {!picked ? (
        <ul className="choices" aria-label="What do you do?">
          {scene.choices.map((c) => (
            <li key={c.id}><Button type="button" variant="outline" className="choice selectable scene-choice" onClick={() => choose(c)}><span className="choice-text">{c.text}</span><ChevronRight aria-hidden="true" /></Button></li>
          ))}
        </ul>
      ) : (
        <>
          <p className="caption">You chose: <strong>{picked.text}</strong></p>
          {ended
            ? picked.best
              ? <Notice title="The best outcome" live>{picked.feedback || "Well done. That's how it should go."}</Notice>
              : <Notice title="Not the best outcome" tone="warning" live>{picked.feedback || "Have another go and try something different."}</Notice>
            : picked.feedback ? <Notice title="What happens" live>{picked.feedback}</Notice> : null}
          <div className="lesson-nav">
            {ended ? <Button type="button" variant={picked.best ? "outline" : "default"} onClick={restart}><RotateCcw aria-hidden="true" />{picked.best ? "Play it again" : "Try again"}</Button> : <span />}
            {!ended ? <Button type="button" onClick={carryOn}>Carry on<ChevronRight aria-hidden="true" /></Button> : null}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

/** Look at the front, think, turn it over, then say whether you knew it.
 *  Cards you didn't know come back until you know them all. */
export function CardDeck({ assignmentId, cards, onFinished }: { assignmentId: string; cards: Card[]; onFinished: () => void }) {
  const [queue, setQueue] = useState(cards.map((c) => c.id));
  const [flipped, setFlipped] = useState(false);
  const [rounds, setRounds] = useState(1);
  const [known, setKnown] = useState(0);
  const [roundLeft, setRoundLeft] = useState(cards.length);
  const card = cards.find((c) => c.id === queue[0]);
  useEffect(() => { if (cards.length && !queue.length) onFinished(); }, [queue.length, cards.length, onFinished]);
  if (!cards.length) return <Notice title="This lesson has no cards yet" />;
  if (!card) {
    return (
      <section className="pc-panel stack" aria-labelledby="deck-done">
        <h2 id="deck-done" role="status">You know all {cards.length} cards</h2>
        <p className="muted">{rounds === 1 ? "First time through. Nicely done." : `It took ${rounds} rounds. Come back to them any time.`}</p>
        <Button type="button" variant="outline" className="self-start max-md:self-stretch" onClick={() => { setQueue(cards.map((c) => c.id)); setKnown(0); setRounds(1); setRoundLeft(cards.length); setFlipped(false); }}><RotateCcw aria-hidden="true" />Go through them again</Button>
      </section>
    );
  }
  function answer(knew: boolean) {
    setFlipped(false);
    if (knew) setKnown((n) => n + 1);
    const [first, ...rest] = queue;
    const next = knew ? rest : [...rest, first];
    // When the last card of this round is answered, the ones still not known make the next round.
    const left = roundLeft - 1;
    if (left === 0 && next.length) { setRounds((r) => r + 1); setRoundLeft(next.length); } else setRoundLeft(left);
    setQueue(next);
  }
  return (
    <section className="stack" aria-label="Flashcards">
      <p className="caption tabular" aria-live="polite">{known} of {cards.length} known · {queue.length} to go</p>
      <div aria-hidden="true"><Bar max={cards.length} value={known} label="Cards known" /></div>
      <Button type="button" variant="outline" className="flashcard" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>
        <span className="caption">{flipped ? "Back" : "Front"} · tap to turn over</span>
        {!flipped && card.imageId ? <CourseImage assignmentId={assignmentId} fileId={card.imageId} alt="" className="choice-image" /> : null}
        <span className="flashcard-text" aria-live="polite">{flipped ? card.back : card.front}</span>
        <RotateCw aria-hidden="true" className="flip-icon" />
      </Button>
      {flipped ? (
        <div className="lesson-nav">
          <Button type="button" variant="outline" onClick={() => answer(false)}><Undo2 aria-hidden="true" />Not yet</Button>
          <Button type="button" onClick={() => answer(true)}><ThumbsUp aria-hidden="true" />I knew it</Button>
        </div>
      ) : <p className="caption">Think of the answer, then turn the card over.</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** Tick each one off as you find, check or do it. Ticks are kept on this phone until the lesson is done. */
export function Checklist({ storageKey, items, onFinished }: { storageKey: string; items: Item[]; onFinished: () => void }) {
  const [ticked, setTicked] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]); } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...ticked])); } catch { /* private browsing: ticks just aren't remembered */ }
    if (items.length && items.every((i) => ticked.has(i.id))) onFinished();
  }, [ticked, items, storageKey, onFinished]);
  const done = items.filter((i) => ticked.has(i.id)).length;
  return (
    <section className="pc-panel stack" aria-labelledby="checklist-title">
      <div className="stack-sm">
        <h2 id="checklist-title">Checklist</h2>
        <p className="caption tabular" aria-live="polite">{done} of {items.length} ticked</p>
        <div aria-hidden="true"><Bar max={items.length} value={done} label="Ticked" /></div>
      </div>
      <ul className="choices">
        {items.map((item) => (
          <li key={item.id}>
            <Label className="choice selectable">
              <Checkbox checked={ticked.has(item.id)} onCheckedChange={(checked) => setTicked((now) => { const next = new Set(now); if (checked === true) next.add(item.id); else next.delete(item.id); return next; })} />
              <span className="choice-text">{item.text}</span>
            </Label>
          </li>
        ))}
      </ul>
      {done === items.length && items.length ? <Notice title="All done" live><Check aria-hidden="true" className="inline-icon" />Every one ticked off.</Notice> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/** A recording from the course, fetched with the person's sign-in and played from a local copy. */
export function AudioPlayer({ assignmentId, fileId, title }: { assignmentId: string; fileId: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let local: string | null = null, live = true;
    apiFile(`training/${assignmentId}/files/${fileId}`)
      .then((blob) => { if (live) { local = URL.createObjectURL(blob); setUrl(local); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [assignmentId, fileId]);
  if (failed) return <Notice title="The recording didn’t load" tone="warning">Check your connection and open the lesson again. The transcript is below.</Notice>;
  return (
    <section className="pc-panel stack-sm" aria-label={`Recording: ${title}`}>
      {url ? <audio controls preload="metadata" src={url} className="audio-player"><track kind="captions" /></audio> : <p className="caption" role="status">Getting the recording…</p>}
      <p className="caption">The transcript is below if you can’t listen right now.</p>
    </section>
  );
}
