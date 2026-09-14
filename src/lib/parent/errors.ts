export class ParentApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers: Record<string, string> = {}) { super(message); }
}

export function unavailable(): never {
  throw new ParentApiError(503, "UNAVAILABLE", "Parent access is not available yet. Please try again later.");
}

export function notFound(): never {
  throw new ParentApiError(404, "NOT_FOUND", "That record is not available.");
}
