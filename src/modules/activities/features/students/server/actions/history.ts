"use server";

import { getSwimmerHistory } from "@/modules/activities/features/students/server/data/history";
import type { HistoryQuery } from "@/modules/activities/features/students/server/history";

/** Read-only; the DAL repeats profile access and audit permission checks. */
export async function loadSwimmerHistory(studentId: string, query: HistoryQuery = {}) {
  return getSwimmerHistory(studentId, query);
}
