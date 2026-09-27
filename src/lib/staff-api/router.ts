import { StaffApiError, notFound } from "@/lib/staff-api/errors";
import { idSchema, json, parseInput, staffResponse } from "@/lib/staff-api/http";
import { rateLimit, requestIp } from "@/lib/staff-api/security";
import { authenticate, logout, requestCode, requestConfirm, verifyCode, verifyConfirm } from "@/lib/staff-api/auth";
import * as records from "@/lib/staff-api/records";

/** /api/staff/v1: the only way Turnfin Me reaches Turnfin. See docs/staff-app.md. */
const ROUTES: Record<string, string[]> = {
  "auth/request-code": ["POST"], "auth/verify-code": ["POST"], "auth/confirm": ["POST"], "auth/confirm/verify": ["POST"], "auth/logout": ["POST"],
  home: ["GET"], me: ["GET", "PATCH"], qualifications: ["GET"], "qualifications/evidence": ["POST"],
  training: ["GET"], reading: ["GET"], shifts: ["GET"], hr: ["GET"], notifications: ["GET", "PUT"],
};

export async function handleStaffRequest(request: Request, path: string[]) {
  return staffResponse(request, async () => {
    const route = path.join("/"), method = request.method;
    const training = /^training\/([A-Za-z0-9_-]+)(\/complete)?$/.exec(route);
    const reading = /^reading\/([A-Za-z0-9_-]+)(\/acknowledge)?$/.exec(route);
    const review = /^hr\/reviews\/([A-Za-z0-9_-]+)\/acknowledge$/.exec(route);
    const methods = training ? [training[2] ? "POST" : "GET"] : reading ? [reading[2] ? "POST" : "GET"] : review ? ["POST"] : ROUTES[route];
    if (!methods) notFound();
    if (!methods.includes(method)) throw new StaffApiError(405, "METHOD_NOT_ALLOWED", "This endpoint does not accept that method.", { Allow: methods.join(", ") });
    await rateLimit(`request-ip:${requestIp(request)}`, 600, 60);
    if (route === "auth/request-code") return json(await requestCode(request), 202);
    if (route === "auth/verify-code") return json(await verifyCode(request));

    const identity = await authenticate(request);
    if (route === "auth/logout") { await logout(identity); return new Response(null, { status: 204 }); }
    if (route === "auth/confirm") return json(await requestConfirm(request, identity), 202);
    if (route === "auth/confirm/verify") return json(await verifyConfirm(request, identity));
    if (route === "home") return json(await records.home(identity));
    if (route === "me") return method === "PATCH" ? json(await records.requestDetailsChange(request, identity), 201) : json(await records.profile(identity));
    if (route === "qualifications") return json(await records.qualifications(identity));
    if (route === "qualifications/evidence") return json(await records.uploadEvidence(request, identity), 201);
    if (route === "training") return json(await records.training(identity));
    if (training) {
      const id = parseInput(idSchema, training[1]);
      return json(training[2] ? await records.completeTraining(request, identity, id) : await records.trainingItem(identity, id));
    }
    if (route === "reading") return json(await records.reading(identity));
    if (reading) {
      const id = parseInput(idSchema, reading[1]);
      return json(reading[2] ? await records.acknowledgeReading(request, identity, id) : await records.readingItem(identity, id));
    }
    if (route === "shifts") return json(await records.shifts(request, identity));
    if (route === "hr") return json(await records.hr(identity));
    if (review) return json(await records.acknowledgeReview(request, identity, parseInput(idSchema, review[1])));
    if (route === "notifications") return json(method === "PUT" ? await records.saveNotifications(request, identity) : await records.notifications(identity));
    notFound();
  });
}
