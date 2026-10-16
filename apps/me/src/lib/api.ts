/** The one way Turnfin Me talks to Turnfin: the staff API. The session token
 *  lives in this tab only (sessionStorage), so closing the app means a new
 *  email code next time. The only other thing kept on the phone is a course the
 *  person chose to save for offline, and their changes waiting for signal
 *  (lib/offline.ts); both go on Sign out. */

import { queue, reached, remember, rememberFile, savedFile, savedResponse, setRefresher, setSender } from "./offline";

const BASE = (process.env.NEXT_PUBLIC_STAFF_API_URL ?? "").replace(/\/$/, "");
const TOKEN = "turnfin-me.token";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function read(key: string) { try { return sessionStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string | null) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* private mode */ }
}

export const session = {
  token: () => read(TOKEN),
  set: (token: string) => write(TOKEN, token),
  clear: () => write(TOKEN, null),
};

const offlineError = () => new ApiError(0, "OFFLINE", "Can't reach Turnfin. Check your connection and try again.");

type Init = { method?: string; body?: unknown; auth?: boolean };

/** One request to Turnfin, with no offline help. */
async function send<T>(path: string, init: Init = {}): Promise<T> {
  if (!BASE) throw new ApiError(503, "UNCONFIGURED", "Turnfin Me is not connected yet.");
  const token = session.token();
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.auth !== false && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    reached(false);
    throw offlineError();
  }
  reached(true);
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401 && init.auth !== false) session.clear();
    throw new ApiError(response.status, error.code ?? "ERROR", error.message ?? "Could not complete that. Try again.");
  }
  return data as T;
}

/** A request to Turnfin. With no signal, a saved course still opens from the
 *  phone, and finishing a lesson, a note or handed-in work waits to be sent. */
export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const method = init.method ?? "GET";
  try {
    const data = await send<T>(path, init);
    if (method === "GET") void remember(path, data);
    return data;
  } catch (caught) {
    if (!(caught instanceof ApiError) || caught.status !== 0) throw caught;
    if (method === "GET") {
      const copy = await savedResponse<T>(path);
      if (copy !== null) return copy;
    } else {
      const waiting = await queue(path, method, init.body).catch(() => null);
      if (waiting) return waiting.result as T;
      throw new ApiError(0, "OFFLINE", "This needs a connection. Try again when you have signal.");
    }
    throw caught;
  }
}

/** A file from the staff API (a lesson's image or PDF) as a Blob, with the
 *  same sign-in as every other call. Kept only for a course saved for offline. */
export async function apiFile(path: string): Promise<Blob> {
  if (!BASE) throw new ApiError(503, "UNCONFIGURED", "Turnfin Me is not connected yet.");
  const token = session.token();
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  } catch {
    reached(false);
    const copy = await savedFile(path);
    if (copy) return copy;
    throw offlineError();
  }
  reached(true);
  if (!response.ok) {
    if (response.status === 401) session.clear();
    throw new ApiError(response.status, "ERROR", "This file isn't available.");
  }
  const blob = await response.blob();
  void rememberFile(path, blob);
  return blob;
}

// Waiting changes go out through the plain request, and a course is brought
// up to date afterwards so the saved copy matches Turnfin.
setSender((path, method, body) => send(path, { method, body }));
setRefresher(async (courseId) => {
  const detail = await send<{ sections: { lessons: { id: string }[] }[] | null }>(`training/${courseId}`);
  await remember(`training/${courseId}`, detail);
  for (const lesson of (detail.sections ?? []).flatMap((s) => s.lessons)) {
    const path = `training/${courseId}/lessons/${lesson.id}`;
    await remember(path, await send(path));
  }
  await remember("training", await send("training"));
});
