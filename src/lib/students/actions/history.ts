"use server";

import { getSwimmerHistory } from "@/lib/students/data/history";
import type { HistoryQuery } from "@/lib/students/history";

/** Read-only; the DAL repeats profile access and audit permission checks. */
export async function loadSwimmerHistory(studentId: string, query: HistoryQuery = {}) {
  return getSwimmerHistory(studentId, query);
}
