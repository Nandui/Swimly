"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ChevronDown, CircleCheck, FileText, Headphones, Pause, Play } from "lucide-react";
import { CardDeck, Checklist, ScenarioPlayer, type Card, type Item, type Scene } from "@/components/lesson-kinds";
import { EmbedFrame, ExplorePicture, SortBoard, type Embed, type Sorting, type Spot } from "@/components/lesson-kinds-more";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Notice } from "@/components/ui";
import { apiFile } from "@/lib/api";

/** Several things in one lesson (owner decision, 29 October 2026): a recording,
 *  slides, a PDF or picture and activities placed in the lesson text. Activities
 *  reuse the lesson kinds' players; each tells the lesson page it is finished. */

/** The lesson page's record of finished activities: which, and how to mark one. */
export const ActivityProgress = createContext<{ done: ReadonlySet<string>; finish: (id: string) => void; storageKey: string } | null>(null);

/** Activities in the text, in order: what must be finished before the lesson is. */
export const bodyActivities = (body: unknown): string[] => {
  const content = (body as { content?: { type?: string; attrs?: { id?: unknown } }[] } | null)?.content ?? [];
  return content.filter((n) => n.type === "activity" && typeof n.attrs?.id === "string").map((n) => String(n.attrs!.id));
};

/** A course file fetched with the person's sign-in, as a local object URL. */
function useCourseFile(assignmentId: string, fileId: string) {
  const [file, setFile] = useState<{ url: string; mime: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let local: string | null = null, live = true;
    apiFile(`training/${assignmentId}/files/${fileId}`)
      .then((blob) => { if (live) { local = URL.createObjectURL(blob); setFile({ url: local, mime: blob.type }); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [assignmentId, fileId]);
  return { file, failed };
}

/** A recording in the text. It keeps playing while the learner scrolls through
 *  slides; once it is off screen a small bar stays at the bottom to pause it. */
export function AudioBlock({ assignmentId, fileId, transcript }: { assignmentId: string; fileId: string; transcript: string }) {
  const { file, failed } = useCourseFile(assignmentId, fileId);
  const box = useRef<HTMLElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  function onPlay() {
    // One recording at a time.
    document.querySelectorAll("audio").forEach((other) => { if (other !== audio.current) other.pause(); });
    setStarted(true); setPlaying(true);
  }
  if (failed) return <Notice title="The recording didn’t load" tone="warning">Check your connection and open the lesson again.{transcript ? " The transcript is under it." : ""}</Notice>;
  return (
    <section ref={box} className="stack-sm audio-block" aria-label="Recording">
      <p className="caption audio-block-label"><Headphones aria-hidden="true" />Recording</p>
      {file ? (
        <audio ref={audio} controls preload="metadata" src={file.url} className="audio-player"
          onPlay={onPlay} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setStarted(false); }}><track kind="captions" /></audio>
      ) : <p className="caption" role="status">Getting the recording…</p>}
      {transcript ? (
        <Collapsible className="reveal">
          <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="reveal-toggle"><span>Show the transcript</span><ChevronDown aria-hidden="true" /></Button></CollapsibleTrigger>
          <CollapsibleContent className="reveal-body"><p className="transcript">{transcript}</p></CollapsibleContent>
        </Collapsible>
      ) : null}
      {started && !inView ? (
        <div className="audio-pinned" role="region" aria-label="Recording">
          <Headphones aria-hidden="true" />
          <span className="audio-pinned-text">{playing ? "Recording playing" : "Recording paused"}</span>
          <Button type="button" variant="ghost" onClick={() => box.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>Show</Button>
          <Button type="button" size="icon" aria-label={playing ? "Pause the recording" : "Play the recording"} onClick={() => playing ? audio.current?.pause() : void audio.current?.play()}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** A PDF or picture shown in the text: a picture in place, a PDF in a frame
 *  (bigger screens) with a button to open it whole. */
export function FileView({ assignmentId, fileId }: { assignmentId: string; fileId: string }) {
  const { file, failed } = useCourseFile(assignmentId, fileId);
  if (failed) return <Notice title="This file didn’t load" tone="warning">Check your connection and open the lesson again.</Notice>;
  if (!file) return <span className="lesson-image-placeholder" role="img" aria-label="Loading the file" />;
  // eslint-disable-next-line @next/next/no-img-element -- a private image from the staff API
  if (file.mime.startsWith("image/")) return <img className="lesson-file-image" src={file.url} alt="" />;
  return (
    <div className="stack-sm">
      <iframe className="file-view" src={file.url} title="PDF in the lesson" />
      <Button asChild variant="outline" className="w-full"><a href={file.url} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Open the PDF</a></Button>
    </div>
  );
}

export const SlidesBlock = ({ embed }: { embed: Embed | null }) => embed ? <EmbedFrame embed={embed} title="Slides" /> : null;

type ActivityData = { steps?: Scene[]; cards?: Card[]; items?: Item[]; groups?: Sorting["groups"]; sorts?: Sorting["sorts"]; spots?: Spot[] };
const LABEL: Record<string, string> = { CHECKLIST: "Checklist", FLASHCARDS: "Flashcards", SORTING: "Sort into groups", SCENARIO: "Scenario", EXPLORE: "Explore a picture" };

/** An activity in the text, played as its lesson kind is, marked done once finished. */
export function ActivityBlock({ assignmentId, id, kind, fileId, data }: { assignmentId: string; id: string; kind: string; fileId: string | null; data: ActivityData | null }) {
  const progress = useContext(ActivityProgress);
  const finish = progress?.finish;
  const finished = useCallback(() => finish?.(id), [finish, id]);
  const done = !!progress?.done.has(id);
  return (
    <section className="stack-sm activity-block" aria-label={`Activity: ${LABEL[kind] ?? "Activity"}`}>
      <p className="caption activity-block-label">
        {done ? <><CircleCheck aria-hidden="true" />{LABEL[kind] ?? "Activity"} · done</> : <>{LABEL[kind] ?? "Activity"} · finish it to carry on</>}
      </p>
      {kind === "CHECKLIST" ? <Checklist storageKey={`${progress?.storageKey ?? "me-blocks"}-${id}`} items={data?.items ?? []} onFinished={finished} /> : null}
      {kind === "FLASHCARDS" ? <CardDeck assignmentId={assignmentId} cards={data?.cards ?? []} onFinished={finished} /> : null}
      {kind === "SORTING" ? <SortBoard sorting={{ groups: data?.groups ?? [], sorts: data?.sorts ?? [] }} onFinished={finished} /> : null}
      {kind === "SCENARIO" ? <ScenarioPlayer assignmentId={assignmentId} steps={data?.steps ?? []} onFinished={finished} /> : null}
      {kind === "EXPLORE" && fileId ? <ExplorePicture assignmentId={assignmentId} fileId={fileId} title="Explore a picture" spots={data?.spots ?? []} onFinished={finished} /> : null}
    </section>
  );
}
