import { authenticateParent, logout, parentProfile, requestCode, updateProfile, verifyCode, withParent } from "@/lib/parent/auth";
import { bookAssessment, getPublicSession, listBookings, listSessions, listSites } from "@/lib/parent/assessments";
import { childDto, listChildren, requireChild } from "@/lib/parent/children";
import { childProgress } from "@/lib/parent/progress";
import { ParentApiError, notFound } from "@/lib/parent/errors";
import { idSchema, json, parentResponse, parseInput } from "@/lib/parent/http";
import { rateLimit, requestIp } from "@/lib/parent/security";
import { createAccessRequest, listAccessRequests } from "@/lib/parent/access-requests";

export async function handleParentRequest(request: Request, path: string[]) {
  return parentResponse(request, async () => {
    const route = path.join("/"), method = request.method;
    const childRoute = /^children\/([A-Za-z0-9_-]+)(\/progress)?$/.exec(route);
    const sessionRoute = /^assessment-sessions\/([A-Za-z0-9_-]+)$/.exec(route);
    const methods = childRoute || sessionRoute ? ["GET"] : ({ "auth/request-code": ["POST"], "auth/verify-code": ["POST"], "auth/logout": ["POST"],
      me: ["GET", "PATCH"], children: ["GET"], sites: ["GET"], "access-requests": ["GET", "POST"], "assessment-sessions": ["GET"], "assessment-bookings": ["GET", "POST"] } as Record<string, string[]>)[route];
    if (!methods) notFound();
    if (!methods.includes(method)) throw new ParentApiError(405, "METHOD_NOT_ALLOWED", "This endpoint does not accept that method.", { Allow: methods.join(", ") });
    await rateLimit(`request-ip:${requestIp(request)}`, 300, 60);
    if (route === "auth/request-code") return json(await requestCode(request), 202);
    if (route === "auth/verify-code") return json(await verifyCode(request));
    if (route === "sites") return json(await listSites());
    if (route === "assessment-sessions") return json(await listSessions(request));
    if (sessionRoute) return json(await getPublicSession(parseInput(idSchema, sessionRoute[1])));
    const identity = await authenticateParent(request);
    if (route === "auth/logout") { await logout(identity); return new Response(null, { status: 204 }); }
    if (route === "access-requests" && method === "POST") {
      const result = await createAccessRequest(request, identity);
      return json(result, result.replayed ? 200 : 201);
    }
    if (route === "me") return json(method === "PATCH" ? await updateProfile(request, identity) : await withParent(identity, async (_tx, account) => parentProfile(account)));
    if (route === "assessment-bookings" && method === "POST") {
      const result = await bookAssessment(request, identity);
      return json(result, result.replayed ? 200 : 201);
    }
    return withParent(identity, async (tx, account) => {
      if (route === "access-requests") return json(await listAccessRequests(request, tx, account));
      if (route === "children") return json(await listChildren(tx, account));
      if (route === "assessment-bookings") return json(await listBookings(request, tx, account));
      if (childRoute) {
        const childId = parseInput(idSchema, childRoute[1]);
        return json(childRoute[2] ? await childProgress(tx, account, childId) : childDto(await requireChild(tx, account, childId)));
      }
      notFound();
    });
  });
}
