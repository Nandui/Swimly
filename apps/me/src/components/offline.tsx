"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CloudDownload, CloudOff, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Bar, Notice } from "@/components/ui";
import { apiFile, api, ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import {
  dismissFailures, failures, flush, isOffline, isSending, onOfflineChange, pending, removeCourse, saveCourse, savedCourses, tidy,
  type Failure, type SavedCourse,
} from "@/lib/offline";

type State = { offline: boolean; waiting: number; sending: boolean; failed: Failure[]; saved: SavedCourse[] };

/** Where the phone stands: offline or not, changes waiting, what's saved.
 *  Read from the offline store whenever it changes. */
export function useOffline() {
  const [state, setState] = useState<State>({ offline: false, waiting: 0, sending: false, failed: [], saved: [] });
  useEffect(() => {
    let live = true;
    const read = async () => {
      const [waiting, failed, saved] = await Promise.all([pending(), failures(), savedCourses()]);
      if (live) setState({ offline: isOffline(), waiting: waiting.length, sending: isSending(), failed, saved });
    };
    void read();
    const stop = onOfflineChange(() => void read());
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => { live = false; stop(); window.removeEventListener("online", read); window.removeEventListener("offline", read); };
  }, []);
  return state;
}

/** Keeps the pages for saved courses on the phone (public/sw.js) and sends
 *  waiting changes when the signal comes back. Once per app, from the Frame. */
let started = false;
function start() {
  if (started) return;
  started = true;
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  void tidy();
  void flush();
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void flush(); });
}

/** The line under the top row: offline, changes waiting or being sent, and
 *  any Turnfin turned down. Nothing at all when there's nothing to say. */
export function OfflineBar() {
  const { offline, waiting, sending, failed } = useOffline();
  useEffect(start, []);
  const changes = `${waiting} ${waiting === 1 ? "change" : "changes"}`;
  return (
    <>
      {offline ? (
        <div className="offline-bar" role="status">
          <WifiOff aria-hidden="true" />
          <p><strong>You’re offline.</strong> Courses saved on this phone still open{waiting ? `, and ${changes} will be sent when you have signal` : ""}.</p>
          <Button asChild variant="ghost"><Link href="/offline">Saved</Link></Button>
        </div>
      ) : waiting ? (
        <div className="offline-bar" role="status">
          <RefreshCw aria-hidden="true" className={sending ? "spin" : undefined} />
          <p>{sending ? `Sending ${changes}…` : `${changes} waiting to send.`}</p>
          {!sending ? <Button type="button" variant="ghost" onClick={() => void flush()}>Send now</Button> : null}
        </div>
      ) : null}
      {failed.length ? (
        <div className="offline-failed">
          <Notice title="Turnfin didn’t take these" tone="warning">
            {failed.map((f) => `${f.label}: ${f.message}`).join(" ")} Open the lesson to do it again.
          </Notice>
          <Button type="button" variant="ghost" className="self-start" onClick={() => void dismissFailures()}>Got it</Button>
        </div>
      ) : null}
    </>
  );
}

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** On a course: keep it on this phone for when there's no signal. */
export function OfflineCourse({ id }: { id: string }) {
  const { offline, saved } = useOffline();
  const copy = saved.find((c) => c.id === id) ?? null;
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useCallback(async () => {
    setProblem(null); setStep({ done: 0, total: 1 });
    try { await saveCourse(id, { json: (path) => api(path), file: apiFile }, (done, total) => setStep({ done, total })); }
    catch (caught) { setProblem(caught instanceof ApiError || caught instanceof Error ? caught.message : "Couldn’t save it. Try again."); }
    finally { setStep(null); }
  }, [id]);
  return (
    <section className="pc-panel" aria-labelledby="offline-title">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pc-tile-icon">{copy ? <CloudDownload aria-hidden="true" /> : <CloudOff aria-hidden="true" />}</span>
        <h2 id="offline-title">{copy ? "Saved on this phone" : "No signal where you train?"}</h2>
      </div>
      <p className="text-ui-muted-foreground">
        {copy
          ? `${copy.lessons} ${copy.lessons === 1 ? "lesson" : "lessons"} · ${size(copy.bytes)} · brought up to date ${date(copy.savedAt)}. Lessons you finish with no signal are sent when you’re back online.`
          : "Save this course and its lessons open with no signal. What you finish is sent to Turnfin when you’re back online."}
      </p>
      <p className="caption">Practice questions, the exam, videos and slides still need a connection. Saved courses are removed after 30 days, and when you sign out.</p>
      {step ? (
        <div className="flex flex-col gap-2" role="status">
          <Bar max={step.total} value={step.done} label="Saving for offline" />
          <p className="caption tabular-nums">Saving {step.done} of {step.total}…</p>
        </div>
      ) : null}
      {problem ? <Notice title="Couldn’t save it" tone="error" live>{problem}</Notice> : null}
      {!step && !offline ? (
        <div className="flex flex-wrap items-center gap-2">
          {copy ? (
            <>
              <Button type="button" variant="outline" onClick={save}><RefreshCw aria-hidden="true" />Bring up to date</Button>
              <Button type="button" variant="ghost" onClick={() => void removeCourse(id)}><Trash2 aria-hidden="true" />Remove</Button>
            </>
          ) : <Button type="button" variant="outline" className="max-md:w-full" onClick={save}><CloudDownload aria-hidden="true" />Save for offline</Button>}
        </div>
      ) : null}
    </section>
  );
}

/** A lesson that needs Turnfin there and then, opened with no signal. */
export function NeedsSignal({ kind }: { kind: string }) {
  const { offline } = useOffline();
  if (!offline) return null;
  const what = kind === "QUIZ" ? "Practice questions are checked by Turnfin" : kind === "VIDEO" ? "Videos play from the internet" : kind === "EMBED" ? "Slides open from the internet" : null;
  if (!what) return null;
  return <Notice title="This lesson needs a connection" tone="warning">{`${what}, so come back to it when you have signal.`}</Notice>;
}
