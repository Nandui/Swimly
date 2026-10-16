import { StaffApiError, notFound } from "@/lib/staff-api/errors";
import { idSchema, json, parseInput, staffResponse } from "@/lib/staff-api/http";
import { rateLimit, requestIp } from "@/lib/staff-api/security";
import { authenticate, logout, requestCode, requestConfirm, verifyCode, verifyConfirm } from "@/lib/staff-api/auth";
import * as records from "@/lib/staff-api/records";

/** /api/staff/v1: the only way Turnfin Me reaches Turnfin. See docs/staff-app.md. */
/** Fixed training/* pages, never an assignment id. */
const TRAINING_PAGES = new Set(["plan", "search", "saved", "record", "catalogue", "refresher"]);

const ROUTES: Record<string, string[]> = {
  "auth/request-code": ["POST"], "auth/verify-code": ["POST"], "auth/confirm": ["POST"], "auth/confirm/verify": ["POST"], "auth/logout": ["POST"],
  home: ["GET"], me: ["GET", "PATCH"], qualifications: ["GET"], "qualifications/evidence": ["POST"],
  training: ["GET"], "training/plan": ["GET"], "training/search": ["GET"], "training/saved": ["GET"], "training/record": ["GET"], "training/catalogue": ["GET"],
  "training/refresher": ["GET"], "training/refresher/answer": ["POST"], reading: ["GET"], shifts: ["GET"], hr: ["GET"], notifications: ["GET", "PUT"],
};

export async function handleStaffRequest(request: Request, path: string[]) {
  return staffResponse(request, async () => {
    const route = path.join("/"), method = request.method;
    const trainingMatch = /^training\/([A-Za-z0-9_-]+)(\/complete|\/feedback)?$/.exec(route);
    const training = trainingMatch && !TRAINING_PAGES.has(trainingMatch[1]) ? trainingMatch : null;
    const lesson = /^training\/([A-Za-z0-9_-]+)\/lessons\/([A-Za-z0-9_-]+)(\/complete|\/check|\/note|\/hand-in|\/hand-in\/file)?$/.exec(route);
    const catalogue = /^training\/catalogue\/([A-Za-z0-9_-]+)\/(cover|enrol)$/.exec(route);
    const exam = /^training\/([A-Za-z0-9_-]+)\/exam(?:\/(start|answers|submit|attempts\/([1-9][0-9]{0,2})))?$/.exec(route);
    const trainingFile = /^training\/([A-Za-z0-9_-]+)\/files\/([A-Za-z0-9_-]+)$/.exec(route);
    const certificate = /^training\/([A-Za-z0-9_-]+)\/certificate$/.exec(route);
    const reading = /^reading\/([A-Za-z0-9_-]+)(\/acknowledge)?$/.exec(route);
    const review = /^hr\/reviews\/([A-Za-z0-9_-]+)\/acknowledge$/.exec(route);
    const methods = training ? [training[2] ? "POST" : "GET"] : lesson ? [lesson[3] === "/note" ? "PUT" : lesson[3] === "/hand-in/file" || !lesson[3] ? "GET" : "POST"]
      : catalogue ? [catalogue[2] === "enrol" ? "POST" : "GET"]
      : exam ? [!exam[2] || exam[3] ? "GET" : exam[2] === "answers" ? "PUT" : "POST"] : trainingFile || certificate ? ["GET"] : reading ? [reading[2] ? "POST" : "GET"] : review ? ["POST"] : ROUTES[route];
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
    if (route === "training/plan") return json(await records.trainingPlan(identity));
    if (route === "training/search") return json(await records.trainingSearch(request, identity));
    if (route === "training/saved") return json(await records.trainingSaved(identity));
    if (route === "training/record") return json(await records.trainingRecord(identity));
    if (route === "training/catalogue") return json(await records.trainingCatalogue(identity));
    if (route === "training/refresher") return json(await records.trainingRefresher(identity));
    if (route === "training/refresher/answer") return json(await records.answerTrainingRefresher(request, identity));
    if (catalogue) {
      const courseId = parseInput(idSchema, catalogue[1]);
      return catalogue[2] === "cover" ? records.trainingCatalogueCover(identity, courseId) : json(await records.enrolOnCourse(identity, courseId), 201);
    }
    if (training) {
      const id = parseInput(idSchema, training[1]);
      if (training[2] === "/feedback") return json(await records.rateTraining(request, identity, id));
      return json(training[2] ? await records.completeTraining(request, identity, id) : await records.trainingItem(identity, id));
    }
    if (lesson) {
      const [id, lessonId] = [parseInput(idSchema, lesson[1]), parseInput(idSchema, lesson[2])];
      if (lesson[3] === "/note") return json(await records.saveTrainingNote(request, identity, id, lessonId));
      if (lesson[3] === "/hand-in") return json(await records.handInTraining(request, identity, id, lessonId));
      if (lesson[3] === "/hand-in/file") return records.trainingHandInFile(identity, id, lessonId);
      return json(lesson[3] === "/check" ? await records.checkTrainingQuiz(request, identity, id, lessonId)
        : lesson[3] ? await records.completeTrainingLesson(identity, id, lessonId) : await records.trainingLesson(identity, id, lessonId));
    }
    if (exam) {
      const id = parseInput(idSchema, exam[1]);
      if (exam[3]) return json(await records.trainingExamResult(identity, id, Number(exam[3])));
      if (exam[2] === "start") return json(await records.startTrainingExam(identity, id));
      if (exam[2] === "answers") return json(await records.saveTrainingExamAnswer(request, identity, id));
      if (exam[2] === "submit") return json(await records.submitTrainingExam(request, identity, id));
      return json(await records.trainingExam(identity, id));
    }
    if (certificate) return json(await records.trainingCertificate(identity, parseInput(idSchema, certificate[1])));
    if (trainingFile) return records.trainingFile(identity, parseInput(idSchema, trainingFile[1]), parseInput(idSchema, trainingFile[2]));
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
