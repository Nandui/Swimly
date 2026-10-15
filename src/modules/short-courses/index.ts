/** Short courses' public API (CLAUDE.md section 6): the only file other modules, Core and
 *  front may import. The status maps are here for Core's tone check; the Rota sees sessions
 *  through commitments (module.ts). */
export {
  HEALTH_FORM_META, SHORT_COURSE_AREA_META, SHORT_COURSE_CALL_DUE_META, SHORT_COURSE_META, SHORT_COURSE_ONLINE_META, SHORT_COURSE_PAYMENT_META, SHORT_COURSE_PLACE_META,
} from "@/modules/short-courses/shared/rules";
