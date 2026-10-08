import { book, course, courses, requestCode, verifyCode } from "@/lib/academy/public/api";
import { AcademyApiError, academyResponse, idSchema, json, notFound, parseInput } from "@/lib/academy/public/http";

/** /api/academy/v1: the only way the Academy booking site reaches Turnfin. See docs/academy.md.
 *
 *  GET  courses               the courses open online
 *  GET  courses/{id}          one of them
 *  POST auth/request-code     email a six-digit code
 *  POST auth/verify-code      a right code gives a token for an hour
 *  POST bookings              hold a place (Bearer token) */
export async function handleAcademyRequest(request: Request, path: string[]) {
  return academyResponse(request, async () => {
    const route = path.join("/"), method = request.method;
    const one = /^courses\/([A-Za-z0-9_-]+)$/.exec(route);
    const methods = one || route === "courses" ? ["GET", "HEAD"] : ["auth/request-code", "auth/verify-code", "bookings"].includes(route) ? ["POST"] : null;
    if (!methods) throw new AcademyApiError(404, "NOT_FOUND", "There is nothing here.");
    if (!methods.includes(method)) throw new AcademyApiError(405, "METHOD_NOT_ALLOWED", "This endpoint does not accept that method.", { Allow: methods.join(", ") });
    if (route === "courses") return json(await courses());
    if (one) return json(await course(parseInput(idSchema, one[1])));
    if (route === "auth/request-code") return json(await requestCode(request), 202);
    if (route === "auth/verify-code") return json(await verifyCode(request));
    if (route === "bookings") return json(await book(request), 201);
    notFound();
  });
}
