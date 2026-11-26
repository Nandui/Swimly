"use client";

import type { ReactNode, Ref } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";

/** A card that turns over: the front and the back are two faces of one
 *  button, so a tap, Space or Enter flips it. Only the face showing is read
 *  out or read aloud. The turn itself is in me.css (`.card-turn`), and is
 *  instant for people who ask for less motion. */
export function TurnCard({ className, flipped, onFlip, front, back, ref }: {
  className: string; flipped: boolean; onFlip: () => void; front: ReactNode; back: ReactNode; ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <Button ref={ref} type="button" variant="outline" className={className} aria-pressed={flipped} onClick={onFlip}>
      <span className="card-turn">
        <span className="card-face" data-side="front" aria-hidden={flipped}>
          <span className="caption">Front · tap to turn over</span>
          {front}
          <RotateCw aria-hidden="true" className="flip-icon" />
        </span>
        <span className="card-face" data-side="back" aria-hidden={!flipped}>
          <span className="caption">Back · tap to turn back</span>
          {back}
          <RotateCw aria-hidden="true" className="flip-icon" />
        </span>
      </span>
    </Button>
  );
}
