/** Taking training with no signal (e-learning phase 9, docs/training.md).
 *
 *  A course the person saves keeps a copy of its lessons and files on this
 *  phone (IndexedDB), so it opens in a plant room or a basement. What they do
 *  with no signal (finishing a lesson, handing in work, a note) waits in an
 *  outbox and goes to Turnfin, with the time it was done, once the phone is
 *  back online. Practice questions and exams are always checked on Turnfin, so
 *  they need a connection.
 *
 *  Only the course material and the person's own unsent changes are kept, for
 *  30 days at most, and everything is removed on Sign out or when someone else
 *  signs in on this phone. */

const DB_NAME = "turnfin-me-offline";
const STORES = ["courses", "responses", "files", "outbox", "meta"] as const;
type Store = (typeof STORES)[number];
/** Saved courses are removed this long after they were last brought up to date. */
export const KEEP_DAYS = 30;
const CHANGED = "turnfin-offline-change";

export type SavedCourse = { id: string; title: string; savedAt: string; bytes: number; lessons: number };
export type Pending = { seq?: number; path: string; method: "POST" | "PUT"; body: Record<string, unknown>; at: string; label: string; courseId: string };
export type Failure = { label: string; message: string; at: string };

// ---------------------------------------------------------------------------
// IndexedDB, as promises
// ---------------------------------------------------------------------------

let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("No offline storage"));
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const d = request.result;
      for (const name of STORES) if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, name === "outbox" ? { keyPath: "seq", autoIncrement: true } : undefined);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
  });
  return opening;
}
function done<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function run<T>(store: Store, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = (await db()).transaction(store, mode);
  const result = await done(work(tx.objectStore(store)));
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  return result;
}
const get = <T>(store: Store, key: IDBValidKey) => run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>).catch(() => undefined);
const put = (store: Store, value: unknown, key?: IDBValidKey) => run(store, "readwrite", (s) => s.put(value, key));
const remove = (store: Store, key: IDBValidKey | IDBKeyRange) => run(store, "readwrite", (s) => s.delete(key));
const all = <T>(store: Store) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>).catch(() => [] as T[]);
const keys = (store: Store) => run<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys()).catch(() => [] as IDBValidKey[]);

function changed() { if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED)); }
export function onOfflineChange(listener: () => void) {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

// ---------------------------------------------------------------------------
// Which requests belong to a saved course
// ---------------------------------------------------------------------------

const COURSE = /^training\/([A-Za-z0-9_-]+)(?:\/(?:lessons\/[A-Za-z0-9_-]+(?:\/hand-in\/file)?|files\/[A-Za-z0-9_-]+))?$/;
/** The course a saved request belongs to, or "list" for My training. */
export function courseOf(path: string): string | null {
  if (path === "training") return "list";
  const match = COURSE.exec(path);
  return match && !["search", "saved", "record", "catalogue", "refresher", "plan"].includes(match[1]) ? match[1] : null;
}
/** Changes that can wait for signal: the rest need Turnfin there and then. */
const QUEUED = /^training\/([A-Za-z0-9_-]+)\/lessons\/([A-Za-z0-9_-]+)\/(complete|note|hand-in)$/;

// ---------------------------------------------------------------------------
// The network, as the app sees it
// ---------------------------------------------------------------------------

let networkDown = false;
/** Called by the API client after every request: did it reach Turnfin? */
export function reached(ok: boolean) {
  if (networkDown === !ok) return;
  networkDown = !ok;
  changed();
  if (ok) void flush();
}
export const isOffline = () => networkDown || (typeof navigator !== "undefined" && navigator.onLine === false);

// ---------------------------------------------------------------------------
// Saved copies
// ---------------------------------------------------------------------------

export async function isSaved(courseId: string) { return !!(await get<SavedCourse>("courses", courseId)); }
export async function savedCourses() {
  const list = await all<SavedCourse>("courses");
  return list.sort((a, b) => a.title.localeCompare(b.title));
}

/** A fresh answer from Turnfin for a saved course replaces the copy. */
export async function remember(path: string, data: unknown) {
  const course = courseOf(path);
  if (!course) return;
  if (course !== "list" && !(await isSaved(course))) return;
  if (course === "list" && !(await keys("courses")).length) return;
  // Changes still waiting keep the copy as the person left it until they're sent.
  if (course !== "list" && (await pending()).some((p) => p.courseId === course)) return;
  await put("responses", { data, at: new Date().toISOString() }, path).catch(() => undefined);
}
export async function rememberFile(path: string, blob: Blob) {
  const course = courseOf(path);
  if (!course || course === "list" || !(await isSaved(course))) return;
  await put("files", blob, path).catch(() => undefined);
}
export async function savedResponse<T>(path: string): Promise<T | null> {
  return ((await get<{ data: T }>("responses", path))?.data) ?? null;
}
export async function savedFile(path: string): Promise<Blob | null> {
  return (await get<Blob>("files", path)) ?? null;
}

type Fetchers = { json: <T>(path: string) => Promise<T>; file: (path: string) => Promise<Blob> };

/** Every file a lesson or course uses: the lesson's own file, pictures and
 *  download buttons in its text, scene and card pictures, and the cover. */
export function fileIds(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) { for (const v of value) fileIds(v, found); return found; }
  if (!value || typeof value !== "object") return found;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && ["fileId", "imageId", "coverId"].includes(key) && /^[A-Za-z0-9_-]{4,64}$/.test(v)) found.add(v);
    else if (key === "file" && v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") found.add((v as { id: string }).id);
    else if (key === "src" && typeof v === "string") { const m = /\/files\/([A-Za-z0-9_-]{4,64})/.exec(v); if (m) found.add(m[1]); }
    else fileIds(v, found);
  }
  return found;
}

type Detail = { id: string; title: string; sections: { lessons: { id: string; title: string; done: boolean; locked?: boolean }[] }[] | null; progress: { done: number; total: number; nextLessonId: string | null } | null; inOrder?: boolean; waitingOn?: string[] };

/** Saves a course for offline: the outline, every lesson, every file, and the
 *  pages to show them (the service worker keeps those). `progress` reports
 *  each step done out of all of them. */
export async function saveCourse(id: string, fetchers: Fetchers, progress: (done: number, total: number) => void = () => {}) {
  const detail = await fetchers.json<Detail>(`training/${id}`);
  const lessons = (detail.sections ?? []).flatMap((s) => s.lessons);
  if (!lessons.length) throw new Error("This course has no lessons to save.");
  let bytes = 0, step = 0;
  const responses: [string, unknown][] = [[`training/${id}`, detail]];
  const files = fileIds(detail);
  const total = lessons.length + 2;
  for (const lesson of lessons) {
    const path = `training/${id}/lessons/${lesson.id}`;
    const data = await fetchers.json<unknown>(path);
    responses.push([path, data]);
    fileIds(data, files);
    progress(++step, total);
  }
  const blobs: [string, Blob][] = [];
  for (const fileId of files) {
    const path = `training/${id}/files/${fileId}`;
    try { const blob = await fetchers.file(path); blobs.push([path, blob]); bytes += blob.size; } catch { /* a file it no longer uses */ }
  }
  progress(++step, total);
  const list = await fetchers.json<unknown>("training").catch(() => null);
  await put("courses", { id, title: detail.title, savedAt: new Date().toISOString(), bytes, lessons: lessons.length } satisfies SavedCourse, id);
  for (const [path, data] of responses) await put("responses", { data, at: new Date().toISOString() }, path);
  for (const [path, blob] of blobs) await put("files", blob, path);
  if (list) await put("responses", { data: list, at: new Date().toISOString() }, "training");
  await warmPages([`/training`, `/training/${id}`, ...lessons.map((l) => `/training/${id}/${l.id}`), "/offline"]);
  progress(total, total);
  changed();
}

/** Loads each page and the scripts it needs, so the service worker keeps
 *  them for when there's no signal. Only when the service worker runs. */
async function warmPages(pages: string[]) {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  const assets = new Set<string>();
  for (const page of pages) {
    try {
      const html = await (await fetch(page, { credentials: "same-origin" })).text();
      for (const m of html.matchAll(/["'](\/_next\/static\/[^"'\s]+)["']/g)) assets.add(m[1]);
    } catch { /* offline already: what's cached stays */ }
  }
  await Promise.all([...assets].map((url) => fetch(url).catch(() => undefined)));
}

/** Removes one saved course and everything kept for it. */
export async function removeCourse(id: string) {
  await remove("courses", id).catch(() => undefined);
  for (const store of ["responses", "files"] as const) {
    for (const key of await keys(store)) if (typeof key === "string" && courseOf(key) === id) await remove(store, key).catch(() => undefined);
  }
  if (!(await keys("courses")).length) await remove("responses", "training").catch(() => undefined);
  changed();
}

/** Removes saved courses not brought up to date for 30 days. */
export async function tidy(now = Date.now()) {
  for (const course of await all<SavedCourse>("courses")) {
    if (now - new Date(course.savedAt).getTime() > KEEP_DAYS * 86_400_000) await removeCourse(course.id);
  }
}

// ---------------------------------------------------------------------------
// Changes made with no signal
// ---------------------------------------------------------------------------

type LessonCopy = { id: string; title: string; done: boolean; locked: string | null; bookmarked: boolean; note: string; kind: string;
  handIn: { review: boolean; submission: Record<string, unknown> | null } | null };

/** Keeps a change for later when the phone is offline and its course is
 *  saved, and shows its result in the saved copy straight away. Null when
 *  it can't wait: the caller then says it needs a connection. */
export async function queue(path: string, method: string, body: unknown): Promise<{ result: unknown } | null> {
  const match = QUEUED.exec(path);
  if (!match || (method !== "POST" && method !== "PUT")) return null;
  const [, courseId, lessonId, action] = match;
  if (!(await isSaved(courseId))) return null;
  const lessonPath = `training/${courseId}/lessons/${lessonId}`;
  const lesson = await savedResponse<LessonCopy>(lessonPath);
  if (!lesson) return null;
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const at = new Date().toISOString();
  const title = `“${lesson.title}”`;
  let result: unknown = undefined;
  if (action === "complete") {
    if (lesson.locked) return null;
    await markDone(courseId, lessonId);
  } else if (action === "note") {
    const next = { bookmarked: typeof input.bookmarked === "boolean" ? input.bookmarked : lesson.bookmarked, note: typeof input.note === "string" ? input.note : lesson.note };
    await put("responses", { data: { ...lesson, ...next }, at }, lessonPath);
    result = next;
  } else {
    const file = input.file as { fileName: string; mime: string; data: string } | null;
    const before = lesson.handIn?.submission as { fileName?: string | null; mime?: string | null } | null;
    const submission = {
      status: lesson.handIn?.review === false ? "ACCEPTED" : "SUBMITTED", text: String(input.text ?? ""),
      fileName: file ? file.fileName : input.keepFile ? before?.fileName ?? null : null, feedback: "", reviewedBy: null, reviewedAt: null, submittedAt: at, waiting: true,
    };
    if (file) await put("files", await (await fetch(`data:${file.mime};base64,${file.data}`)).blob(), `${lessonPath}/hand-in/file`);
    await put("responses", { data: { ...lesson, handIn: lesson.handIn && { ...lesson.handIn, submission } }, at }, lessonPath);
  }
  const label = action === "complete" ? `Finishing ${title}` : action === "note" ? `Your note on ${title}` : `Your work for ${title}`;
  // A note replaces the one waiting before it.
  if (action === "note") for (const p of await all<Pending>("outbox")) if (p.path === path && p.seq !== undefined) await remove("outbox", p.seq);
  await put("outbox", { path, method, body: action === "note" ? input : { ...input, at }, at, label, courseId } satisfies Pending);
  changed();
  return { result };
}

/** A lesson finished with no signal: ticked in the course, the next one
 *  opened when lessons go in order. */
async function markDone(courseId: string, lessonId: string) {
  const at = new Date().toISOString();
  const detail = await savedResponse<Detail>(`training/${courseId}`);
  const lessonPath = `training/${courseId}/lessons/${lessonId}`;
  const lesson = await savedResponse<LessonCopy>(lessonPath);
  if (lesson) await put("responses", { data: { ...lesson, done: true }, at }, lessonPath);
  if (!detail?.sections || !detail.progress) return;
  const lessons = detail.sections.flatMap((s) => s.lessons);
  for (const l of lessons) if (l.id === lessonId) l.done = true;
  const firstOpen = lessons.find((l) => !l.done) ?? null;
  for (const [i, l] of lessons.entries()) {
    const before = lessons.slice(0, i).find((x) => !x.done);
    const locked = !!detail.waitingOn?.length || (!!detail.inOrder && !l.done && !!before);
    l.locked = locked;
    const copyPath = `training/${courseId}/lessons/${l.id}`;
    const copy = await savedResponse<LessonCopy>(copyPath);
    if (copy && !detail.waitingOn?.length && copy.locked && !locked) await put("responses", { data: { ...copy, locked: null }, at }, copyPath);
    // Its reason named a lesson now done: say it plainly instead.
    else if (copy?.locked && locked && !detail.waitingOn?.length && before) await put("responses", { data: { ...copy, locked: `This course goes in order. Finish “${before.title}” first.` }, at }, copyPath);
  }
  detail.progress = { ...detail.progress, done: lessons.filter((l) => l.done).length, nextLessonId: firstOpen?.id ?? null };
  await put("responses", { data: detail, at }, `training/${courseId}`);
}

export async function pending() { return all<Pending>("outbox"); }
export async function failures() { return (await get<Failure[]>("meta", "failures")) ?? []; }
export async function dismissFailures() { await remove("meta", "failures").catch(() => undefined); changed(); }

type Sender = (path: string, method: string, body: unknown) => Promise<unknown>;
let sender: Sender | null = null;
let sending: Promise<void> | null = null;
/** The API client hands over how to send, so this file needs no import of it. */
export function setSender(send: Sender) { sender = send; }
export const isSending = () => !!sending;

/** Sends what waited, oldest first. Stops at the first one that can't reach
 *  Turnfin (or needs a sign-in) and tries again later. One Turnfin refuses is
 *  dropped and listed, so the person knows. Then the saved copies are refreshed. */
export function flush(): Promise<void> {
  if (sending || !sender) return sending ?? Promise.resolve();
  sending = (async () => {
    changed();
    const courses = new Set<string>();
    for (const item of await pending()) {
      try {
        await sender!(item.path, item.method, item.body);
        courses.add(item.courseId);
      } catch (caught) {
        const status = (caught as { status?: number }).status ?? 0;
        if (status === 0 || status === 401 || status === 429 || status >= 500) break;
        const list = await failures();
        await put("meta", [...list, { label: item.label, message: (caught as Error).message, at: item.at }].slice(-10), "failures");
      }
      if (item.seq !== undefined) await remove("outbox", item.seq);
      changed();
    }
    for (const id of courses) await refresh(id);
  })().finally(() => { sending = null; changed(); });
  return sending;
}

let refresher: ((courseId: string) => Promise<void>) | null = null;
export function setRefresher(fn: (courseId: string) => Promise<void>) { refresher = fn; }
async function refresh(courseId: string) { try { await refresher?.(courseId); } catch { /* next time */ } }

// ---------------------------------------------------------------------------
// Whose phone this is
// ---------------------------------------------------------------------------

async function hash(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text.trim().toLowerCase()));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** After signing in: someone else's saved courses and unsent changes go. */
export async function claim(email: string) {
  try {
    const mine = await hash(email);
    const owner = await get<string>("meta", "owner");
    if (owner && owner !== mine) await clearAll();
    await put("meta", mine, "owner");
  } catch { /* no offline storage on this phone */ }
}
/** Sign out: nothing stays on the phone. */
export async function clearAll() {
  try {
    for (const store of STORES) await run(store, "readwrite", (s) => s.clear());
  } catch { /* nothing kept */ }
  changed();
}
