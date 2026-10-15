/** Online booking for the public booking site (apps/academy, docs/academy.md): the site's API
 *  (courses from every module, email codes, held places, a customer's bookings) and the
 *  Academy's own courses on it. Entry for its API route and module.ts. */
export { handleAcademyRequest } from "@/modules/academy/features/booking/server/router";
export { academyPublicCourses } from "@/modules/academy/features/booking/server/source";
