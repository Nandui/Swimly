import { PublicApiError } from "@/lib/public-api/http";

export class ParentApiError extends PublicApiError {}

export function unavailable(): never {
  throw new ParentApiError(503, "UNAVAILABLE", "Parent access is not available yet. Try again later.");
}

export function notFound(): never {
  throw new ParentApiError(404, "NOT_FOUND", "That record is not available.");
}
