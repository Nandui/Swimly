import type { ActionResult } from "@/lib/action-result";
import { dublinInstant, PARENT_TIMEZONE } from "./time";

export type GuardianAccess = {
  id: string; parentEmail: string; source: string; revokedAt: string | null;
  createdAt: string; updatedAt: string;
};
export type ManagedParentAccount = {
  id: string; email: string; name: string | null; phone: string | null;
  isActive: boolean; createdAt: string;
};
export type AssessmentPublication = {
  sessionId: string; enabled: boolean; bookingClosesAt: string | null;
  canPublish: boolean; visibleToParents: boolean; spacesAvailable: number | null;
};

export const PARENT_ACCESS_META = {
  approved: { label: "Approved", color: "green" },
  revoked: { label: "Revoked", color: "gray" },
} as const;
export const ACCESS_REQUEST_META = {
  PENDING: { label: "Waiting for review", color: "orange" },
  APPROVED: { label: "Approved", color: "green" },
  DECLINED: { label: "Declined", color: "gray" },
} as const;
export type AccessReview = {
  id: string; firstName: string; lastName: string; dateOfBirth: string; context: string;
  status: keyof typeof ACCESS_REQUEST_META; reply: string | null; createdAt: string; reviewedAt: string | null;
  reviewedByName: string | null; parent: Pick<ManagedParentAccount, "id" | "email" | "name" | "phone" | "isActive">;
  student: { id: string; firstName: string; lastName: string } | null;
};
export const PARENT_ACCOUNT_META = {
  active: { label: "Active", color: "green" },
  suspended: { label: "Suspended", color: "red" },
} as const;
export const PUBLICATION_META = {
  unpublished: { label: "Not published", color: "gray" },
  published: { label: "Published", color: "green" },
  closed: { label: "Booking closed", color: "orange" },
} as const;

/** Staff cookies only; no parent tokens or server configuration enter the browser. */
export async function parentAdminRequest<T>(path: string, options: {
  method?: "GET" | "PUT" | "DELETE" | "PATCH"; body?: unknown; signal?: AbortSignal;
} = {}): Promise<T> {
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(`/api/parent-admin/v1/${path}`, {
      method, credentials: "same-origin", cache: "no-store", redirect: "error",
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
      ...(options.body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new Error(method === "GET" ? "Could not load this information. Check your connection and try again."
      : "We could not confirm the save. Refresh the record before trying again.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) {
    throw new Error(response.status === 401 ? "Your session has ended. Sign in again, then retry."
      : body?.error?.message ?? (method === "GET" ? "Could not load this information. Refresh the page and try again."
        : "We could not confirm the save. Refresh the record before trying again."));
  }
  return body as T;
}

/** Adapt the existing API to FormDialog's retained-input/error contract. */
export async function saveParentAdmin(path: string, method: "PUT" | "DELETE" | "PATCH", body: { reason: string } & Record<string, unknown>): Promise<ActionResult> {
  if (body.reason.trim().length < 3 || body.reason.trim().length > 500) {
    const error = "Enter a reason between 3 and 500 characters.";
    return { ok: false, error, fieldErrors: { reason: error } };
  }
  try {
    await parentAdminRequest<unknown>(path, { method, body: { ...body, reason: body.reason.trim() } });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not confirm the change. Refresh the record." };
  }
}

export function dublinDateTimeInput(value: string | null) {
  if (!value) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: PARENT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** datetime-local is explicitly Ireland wall time, regardless of device timezone. */
export function bookingDeadline(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const instant = match && Number(match[2]) < 24 && Number(match[3]) < 60
    ? dublinInstant(match[1], Number(match[2]) * 60 + Number(match[3])) : null;
  if (!instant) throw new Error("Choose a valid booking deadline in Ireland time. This time may fall in a clock change.");
  return instant.toISOString();
}

export function parentDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IE", { timeZone: PARENT_TIMEZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
