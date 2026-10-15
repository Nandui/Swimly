/** The one way the booking site talks to Turnfin: the booking API (/api/academy/v1). Signing in
 *  checks an email with a code and gives a token for a week, kept in this browser
 *  (localStorage) until it runs out or the person signs out. Nothing else personal is kept. */

const BASE = (process.env.NEXT_PUBLIC_ACADEMY_API_URL ?? "").replace(/\/$/, "");
const KEY = "academy.session";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

type Stored = { token: string; email: string; expiresAt: string };
const listeners = new Set<() => void>();

function read(): Stored | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    return value && Date.parse(value.expiresAt) - Date.now() > 60_000 ? value : null;
  } catch { return null; }
}
function write(value: Stored | null) {
  try { if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

/** Who is signed in on this browser, while their token lasts. */
export const session = {
  get(): { token: string; email: string } | null { const s = read(); return s ? { token: s.token, email: s.email } : null; },
  set: (value: Stored) => write(value),
  clear: () => write(null),
  subscribe(fn: () => void) {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) fn(); };
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
  },
};

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  if (!BASE) throw new ApiError(503, "UNCONFIGURED", "Online booking is not connected yet.");
  const token = init.auth ? session.get()?.token : undefined;
  if (init.auth && !token) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to carry on.");
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "OFFLINE", "Can't connect. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401 && init.auth) session.clear();
    throw new ApiError(response.status, error.code ?? "ERROR", error.message ?? "Could not complete that. Try again.");
  }
  return data as T;
}

export const message = (e: unknown) => (e instanceof ApiError ? e.message : "Could not complete that. Try again.");

/** Sign out here and end the token on the server too (best effort). */
export async function signOut() {
  try { await api("auth/logout", { method: "POST", body: {}, auth: true }); } catch { /* signed out here anyway */ }
  session.clear();
}

export type Session = { date: string; start: string; end: string; place: string };
export type Course = {
  id: string; source: string; name: string; group: "qualification" | "course"; category: string; categoryLabel: string; description: string;
  awardingBody: string; minAge: number | null; checks: string[]; askDateOfBirth: boolean; site: string; priceCents: number; price: string;
  placesLeft: number; waitingList: boolean; firstDay: string | null; lastDay: string | null; sessions: Session[];
};
export type Hold = {
  reference: string; outcome: "held" | "waiting"; callBy: string | null; callByLabel: string | null; phone: string; price: string;
  course: { name: string; site: string; starts: string };
};
export type BookingState = "to-pay" | "booked" | "waiting" | "done" | "withdrawn" | "cancelled";
export type Booking = {
  id: string; source: string; reference: string | null; courseId: string; name: string; person: string; categoryLabel: string; site: string;
  firstDay: string | null; lastDay: string | null; sessions: number; next: Session | null; state: BookingState; detail: string;
  priceCents: number; paidCents: number; owedCents: number; callBy: string | null;
};
