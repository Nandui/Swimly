/** The one way Turnfin Me talks to Turnfin: the staff API. The session token
 *  lives in this tab only (sessionStorage), so closing the app means a new
 *  email code next time. Nothing personal is cached anywhere else. */

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

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
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
    throw new ApiError(0, "OFFLINE", "Can't reach Turnfin. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error ?? {};
    if (response.status === 401 && init.auth !== false) session.clear();
    throw new ApiError(response.status, error.code ?? "ERROR", error.message ?? "Could not complete that. Try again.");
  }
  return data as T;
}
