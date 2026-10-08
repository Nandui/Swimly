/** The one way the booking site talks to Turnfin: the Academy API. The email check's token lives
 *  in this tab only (sessionStorage) and lasts an hour; nothing personal is kept anywhere else. */

const BASE = (process.env.NEXT_PUBLIC_ACADEMY_API_URL ?? "").replace(/\/$/, "");
const TOKEN = "academy.token";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function read(key: string) { try { return sessionStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string | null) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* private mode */ }
}

/** The checked email and its token, while it lasts. */
export const checked = {
  get(): { token: string; email: string } | null {
    try {
      const value = JSON.parse(read(TOKEN) ?? "null") as { token: string; email: string; expiresAt: string } | null;
      return value && Date.parse(value.expiresAt) - Date.now() > 60_000 ? { token: value.token, email: value.email } : null;
    } catch { return null; }
  },
  set: (value: { token: string; email: string; expiresAt: string }) => write(TOKEN, JSON.stringify(value)),
  clear: () => write(TOKEN, null),
};

export async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  if (!BASE) throw new ApiError(503, "UNCONFIGURED", "Online booking is not connected yet.");
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
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
    if (response.status === 401) checked.clear();
    throw new ApiError(response.status, error.code ?? "ERROR", error.message ?? "Could not complete that. Try again.");
  }
  return data as T;
}

export type Course = {
  id: string; name: string; kind: string; kindLabel: string; awardingBody: string; minAge: number | null; checks: string[];
  site: string; priceCents: number; price: string; placesLeft: number; firstDay: string | null; lastDay: string | null;
  sessions: { date: string; start: string; end: string; place: string }[];
};
