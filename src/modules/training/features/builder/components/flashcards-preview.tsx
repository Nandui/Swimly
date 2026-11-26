"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";
import { fileSrc, type Flashcard } from "@/modules/training/shared/lessons";

/** A Flashcards lesson in Preview, played as the learner plays it in Turnfin
 *  Me: one card at a time, turned over with a click, Space or Enter, with
 *  Previous and Next (the arrow keys too). Nothing is recorded, so there is no
 *  "I knew it" here. The turn is `.tf-deck-*` in src/app/training/lesson.css. */
export function FlashcardsPreview({ cards }: { cards: Flashcard[] }) {
  const [place, setPlace] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // Each card is a new button, so a keyboard that was on the card stays on the card.
  const cardButton = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => { if (refocus.current) { refocus.current = false; cardButton.current?.focus(); } });
  if (!cards.length) return <Notice tone="warning" title="This lesson has no cards yet" />;
  const at = Math.min(place, cards.length - 1);
  const card = cards[at];
  function go(to: number) { refocus.current = document.activeElement === cardButton.current; setPlace(Math.max(0, Math.min(cards.length - 1, to))); setFlipped(false); }
  function keys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") { event.preventDefault(); go(at + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(at - 1); }
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Flashcards" onKeyDown={keys}>
      <Notice title="Learners turn each card over, then say whether they knew it">Cards they didn’t know come round again until they know them all. Click a card to turn it over.</Notice>
      <p className="sr-only" role="status">Card {at + 1} of {cards.length}, {flipped ? "back" : "front"}.</p>
      <Button key={card.id} ref={cardButton} type="button" variant="outline" className="tf-deck-card" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>
        <span className="tf-deck-turn">
          <span className="tf-deck-face" data-side="front" aria-hidden={flipped}>
            <span className="text-xs font-semibold text-ui-muted-foreground">Front · click to turn over</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
            {card.imageId ? <img src={fileSrc(card.imageId)} alt="" loading="lazy" /> : null}
            <span className="tf-deck-text">{card.front}</span>
            <RotateCw aria-hidden="true" className="tf-deck-icon" />
          </span>
          <span className="tf-deck-face" data-side="back" aria-hidden={!flipped}>
            <span className="text-xs font-semibold">Back · click to turn back</span>
            <span className="tf-deck-text">{card.back}</span>
            <RotateCw aria-hidden="true" className="tf-deck-icon" />
          </span>
        </span>
      </Button>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" className="min-h-11" disabled={at === 0} onClick={() => go(at - 1)}><ChevronLeft aria-hidden="true" />Previous</Button>
        <p className="font-semibold tabular-nums" aria-hidden="true">{at + 1} of {cards.length}</p>
        <Button type="button" variant="outline" className="min-h-11" disabled={at === cards.length - 1} onClick={() => go(at + 1)}>Next<ChevronRight aria-hidden="true" /></Button>
      </div>
    </section>
  );
}
