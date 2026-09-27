/** Errors the staff API (Turnfin Me) returns. Messages are written for staff
 *  and never contain record values, credentials or provider details. */
export class StaffApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers: Record<string, string> = {}) { super(message); }
}

export function unavailable(): never {
  throw new StaffApiError(503, "UNAVAILABLE", "Turnfin Me is not available yet. Please try again later.");
}

export function notFound(): never {
  throw new StaffApiError(404, "NOT_FOUND", "That record is not available.");
}

export function unauthenticated(): never {
  throw new StaffApiError(401, "UNAUTHENTICATED", "Please sign in again.");
}

/** HR records need a fresh email code on top of the session. */
export function confirmRequired(): never {
  throw new StaffApiError(403, "CONFIRM_REQUIRED", "Enter a fresh code to open this.");
}
