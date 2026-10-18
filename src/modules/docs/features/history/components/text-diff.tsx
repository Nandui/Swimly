'use client';
import { diffWords } from 'diff';

/** Word-level changes between two versions: added text underlined, removed struck through. */
export function TextDiff({ before, after }: { before: string; after: string }) {
  return diffWords(before, after).map((part, i) =>
    part.added ? <ins key={i}>{part.value}</ins> : part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>,
  );
}
