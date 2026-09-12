type Params = Record<string, string | string[] | undefined>;
export type SwimmerStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function swimmerFilters(params: Params) {
  const status: SwimmerStatusFilter = params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : "ALL";
  const requested = typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  return {
    q: typeof params.q === "string" ? params.q.trim() : "",
    status,
    page: Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
  };
}

export function swimmerDirectoryHref({ q = "", status = "ALL", page = 1 }: { q?: string; status?: SwimmerStatusFilter; page?: number } = {}) {
  const query = new URLSearchParams();
  if (q.trim()) query.set("q", q.trim());
  if (status !== "ALL") query.set("status", status);
  if (Number.isSafeInteger(page) && page > 1) query.set("page", String(page));
  return `/students${query.size ? `?${query}` : ""}`;
}

/** Carry only directory filters through profiles; never accept an external destination. */
export function swimmerReturnHref(value: string | string[] | undefined) {
  if (typeof value !== "string" || (value !== "/students" && !value.startsWith("/students?"))) return "/students";
  const query = new URLSearchParams(value.slice("/students?".length));
  return swimmerDirectoryHref(swimmerFilters(Object.fromEntries(query)));
}

export function swimmerProfileHref(id: string, returnTo = "/students", tab?: string) {
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  const back = swimmerReturnHref(returnTo);
  if (back !== "/students") query.set("returnTo", back);
  return `/students/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`;
}
