type ClassScreenAccess = { calendar: boolean; instructor: boolean; courses: boolean };
export type ClassWorkspace = "desk" | "instructor";
export type ClassQuery = Record<string, string | string[] | undefined>;

/** Only known filters travel with an instructor. No caller-supplied return URL. */
function instructorQuery(params: ClassQuery) {
  const query = new URLSearchParams();
  if (params.tab === "all") query.set("tab", "all");
  if (params.group === "level") query.set("group", "level");
  return query;
}

export function instructorHomeHref(params: ClassQuery = {}) {
  const query = instructorQuery(params).toString();
  return query ? `/instructor?${query}` : "/instructor";
}

export function instructorClassHref(id: string, params: ClassQuery = {}) {
  const query = instructorQuery(params);
  if (typeof params.date === "string") query.set("date", params.date);
  if (params.step === "competencies") query.set("step", "competencies");
  const search = query.toString();
  return `/instructor/classes/${encodeURIComponent(id)}${search ? `?${search}` : ""}`;
}

/** Each workspace returns within its own boundary, regardless of overlapping
 * screen grants. A request parameter can never select another workspace. */
export function classReturnDestination(access: ClassScreenAccess, from: unknown, courseId: string, workspace: ClassWorkspace = "desk", params: ClassQuery = {}) {
  if (workspace === "instructor") {
    return access.instructor ? { href: instructorHomeHref(params), label: "Instructor", source: "instructor" } : null;
  }
  if (from === "today" && access.calendar) return { href: "/today", label: "Today", source: "today" };
  if (access.courses) return { href: `/courses/${encodeURIComponent(courseId)}`, label: "class", source: null };
  if (access.calendar) return { href: "/today", label: "Today", source: "today" };
  return null;
}

/** Old bookmarks keep their date and step without granting another workspace. */
export function legacyClassHref(id: string, params: ClassQuery, instructor: boolean, desk: boolean) {
  if (instructor && (params.from === "instructor" || !desk)) return instructorClassHref(id, params);
  const query = new URLSearchParams();
  if (typeof params.date === "string") query.set("date", params.date);
  if (params.step === "competencies") query.set("step", "competencies");
  if (params.from === "today") query.set("from", "today");
  const search = query.toString();
  return `/courses/${encodeURIComponent(id)}/class${search ? `?${search}` : ""}`;
}
