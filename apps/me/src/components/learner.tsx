"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Bookmark, BookmarkCheck, Square, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

/** The learner's own tools (Training e-learning phase 6): text size, read
 *  aloud, bookmarks and private notes on lessons, and rating a course. */

// ---------------------------------------------------------------------------
// Text size and reading speed: this phone only, kept in the browser
// ---------------------------------------------------------------------------

export const TEXT_SIZES = [
  { id: "normal", label: "Standard" },
  { id: "large", label: "Large" },
  { id: "largest", label: "Largest" },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]["id"];
export const SPEECH_RATES = [
  { id: "normal", label: "Normal", rate: 1 },
  { id: "slower", label: "Slower", rate: 0.8 },
] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number]["id"];

const TEXT_KEY = "turnfin-me.text-size";
const RATE_KEY = "turnfin-me.speech-rate";
const listeners = new Set<() => void>();
function readPref(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: this visit only */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useTextSize(): [TextSize, (size: TextSize) => void] {
  const value = useSyncExternalStore(subscribe, () => readPref(TEXT_KEY), () => null);
  const size = (TEXT_SIZES.some((s) => s.id === value) ? value : "normal") as TextSize;
  return [size, (next) => writePref(TEXT_KEY, next)];
}
export function useSpeechRate(): [SpeechRate, (rate: SpeechRate) => void] {
  const value = useSyncExternalStore(subscribe, () => readPref(RATE_KEY), () => null);
  const rate = (SPEECH_RATES.some((s) => s.id === value) ? value : "normal") as SpeechRate;
  return [rate, (next) => writePref(RATE_KEY, next)];
}

/** Puts the chosen text size on the page; every screen's Frame renders it. */
export function TextSizeEffect() {
  const [size] = useTextSize();
  useEffect(() => {
    if (size === "normal") delete document.documentElement.dataset.text;
    else document.documentElement.dataset.text = size;
  }, [size]);
  return null;
}

// ---------------------------------------------------------------------------
// Read aloud: the phone's own voice, nothing sent anywhere
// ---------------------------------------------------------------------------

const noSubscription = () => () => {};
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Reads the text inside `target` aloud. Hidden where the phone can't speak. */
export function ReadAloud({ target, label = "Read aloud" }: { target: RefObject<HTMLElement | null>; label?: string }) {
  const supported = useSyncExternalStore(noSubscription, canSpeak, () => false);
  const [speaking, setSpeaking] = useState(false);
  const [rate] = useSpeechRate();
  // Stop when the lesson changes or the page closes.
  useEffect(() => () => { if (canSpeak()) window.speechSynthesis.cancel(); }, []);
  if (!supported) return null;
  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const text = (target.current?.innerText ?? "").replace(/\s+\n/g, "\n").trim();
    if (!text) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IE";
    utterance.rate = SPEECH_RATES.find((r) => r.id === rate)?.rate ?? 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  }
  return (
    <Button type="button" variant="outline" onClick={toggle} aria-pressed={speaking}>
      {speaking ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}{speaking ? "Stop reading" : label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Bookmarks and private notes on a lesson
// ---------------------------------------------------------------------------

type Saved = { bookmarked: boolean; note: string };
const notePath = (assignmentId: string, lessonId: string) => `training/${assignmentId}/lessons/${lessonId}/note`;

export function BookmarkButton({ assignmentId, lessonId, initial }: { assignmentId: string; lessonId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function toggle() {
    setBusy(true); setFailure(null);
    const next = !on;
    setOn(next);
    try { setOn((await api<Saved>(notePath(assignmentId, lessonId), { method: "PUT", body: { bookmarked: next } })).bookmarked); }
    catch (caught) { setOn(!next); setFailure(caught instanceof ApiError ? caught.message : "That didn't save."); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Button type="button" variant="outline" onClick={toggle} disabled={busy} aria-pressed={on}>
        {on ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{on ? "Bookmarked" : "Bookmark"}
      </Button>
      {failure ? <Notice title={failure} tone="error" live /> : null}
    </>
  );
}

export function LessonNote({ assignmentId, lessonId, initial }: { assignmentId: string; lessonId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone?: "error"; title: string } | null>(null);
  async function save() {
    setBusy(true); setStatus(null);
    try {
      const result = await api<Saved>(notePath(assignmentId, lessonId), { method: "PUT", body: { note: text } });
      setSaved(result.note); setText(result.note);
      setStatus({ title: result.note ? "Note saved" : "Note removed" });
    } catch (caught) { setStatus({ tone: "error", title: caught instanceof ApiError ? caught.message : "That didn't save. Try again." }); }
    finally { setBusy(false); }
  }
  const id = `note-${lessonId}`;
  return (
    <section className="pc-panel stack-sm" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>My notes</h2>
      <Textarea id={id} aria-label="My notes on this lesson" description="Only you can see your notes. Find them again under Saved." maxLength={2000} value={text}
        onChange={(e) => { setText(e.target.value); setStatus(null); }} placeholder="Anything to remember from this lesson" />
      {status ? <Notice title={status.title} tone={status.tone} live /> : null}
      <Button type="button" variant="outline" className="self-start max-md:self-stretch" onClick={save} disabled={busy || text.trim() === saved}>{busy ? "Saving…" : "Save note"}</Button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rating a finished course
// ---------------------------------------------------------------------------

const STAR_WORDS = ["", "Poor", "Not great", "OK", "Good", "Excellent"];

export function RateCourse({ assignmentId, initial }: { assignmentId: string; initial: { rating: number; unclear: string } | null }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [unclear, setUnclear] = useState(initial?.unclear ?? "");
  const [sent, setSent] = useState(initial);
  const [editing, setEditing] = useState(!initial);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  async function send() {
    setBusy(true); setFailure(null);
    try {
      const result = await api<{ rating: number; unclear: string }>(`training/${assignmentId}/feedback`, { method: "POST", body: { rating, unclear } });
      setSent(result); setEditing(false); setJustSent(true);
    } catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't send. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <section className="pc-panel stack-sm" aria-labelledby="rate-title">
      <h2 id="rate-title">How was this course?</h2>
      {!editing && sent ? (
        <>
          <p role={justSent ? "status" : undefined}><span className="stars-read" aria-label={`${sent.rating} of 5 stars`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} aria-hidden="true" data-on={n <= sent.rating || undefined} />)}</span> Thanks, your trainer will see this without your name.</p>
          {sent.unclear ? <p className="muted pre">{sent.unclear}</p> : null}
          <Button type="button" variant="ghost" className="self-start" onClick={() => { setEditing(true); setJustSent(false); setTimeout(() => first.current?.focus(), 0); }}>Change my answer</Button>
        </>
      ) : (
        <>
          <p className="muted">It helps whoever wrote it make it better. They see your answer without your name.</p>
          <fieldset className="flex flex-col gap-2">
            <legend>Your rating</legend>
            <RadioGroup className="stars" name="rating" value={rating ? String(rating) : ""} onValueChange={(value) => setRating(Number(value))} aria-describedby="rating-hint">
              {[1, 2, 3, 4, 5].map((n) => (
                <Label key={n} className="star" data-on={n <= rating || undefined}>
                  <RadioGroupItem ref={n === 1 ? first : undefined} value={String(n)} className="sr-only" aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${STAR_WORDS[n]}`} />
                  <Star aria-hidden="true" />
                </Label>
              ))}
            </RadioGroup>
            <span id="rating-hint" className="caption" aria-live="polite">{rating ? STAR_WORDS[rating] : "Tap a star."}</span>
          </fieldset>
          <Textarea id="unclear" label="Was anything unclear?" optional maxLength={1000} value={unclear} onChange={(e) => setUnclear(e.target.value)} placeholder="A lesson, a question or a word that didn't make sense" />
          {failure ? <Notice title={failure} tone="error" live /> : null}
          <Button type="button" className="self-start max-md:self-stretch" onClick={send} disabled={busy || !rating}>{busy ? "Sending…" : "Send"}</Button>
        </>
      )}
    </section>
  );
}
