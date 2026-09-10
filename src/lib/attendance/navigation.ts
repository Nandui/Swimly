type ClassScreenAccess = { calendar: boolean; instructor: boolean; courses: boolean };

/** Only known, accessible destinations are accepted; never use a return URL
 * supplied by the request. Preserve the entry page through both deck steps. */
export function classReturnDestination(access: ClassScreenAccess, from: unknown, courseId: string) {
  if (from === "today" && access.calendar) return { href: "/today", label: "Today", source: "today" };
  if (from === "instructor" && access.instructor) return { href: "/instructor", label: "Instructor", source: "instructor" };
  if (access.instructor) return { href: "/instructor", label: "Instructor", source: "instructor" };
  if (access.calendar) return { href: "/today", label: "Today", source: "today" };
  if (access.courses) return { href: `/courses/${courseId}`, label: "class", source: null };
  return null;
}
