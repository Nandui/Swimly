"use server";

import { getSwimmerHistory } from "@/modules/activities/lib/students/data/history";
import type { HistoryQuery } from "@/modules/activities/lib/students/history";

/** Read-only; the DAL repeats profile access and audit permission checks. */
export async function loadSwimmerHistory(studentId: string, query: HistoryQuery = {}) {
  return getSwimmerHistory(studentId, query);
}
