"use client";

import { createContext, useContext } from "react";
import type { Held } from "@/modules/rota/shared/fit";
import type { Diary, DiaryInput, Need, Span } from "@/modules/rota/features/diary/model";

/** What the day's diary screens share: the day, who could come into it, and how to open the two
 *  sheets (filling a need, someone's day). */
export type DiaryData = {
  siteId: string;
  date: string;
  /** "Wednesday 21 Oct". */
  dateLabel: string;
  today: boolean;
  /** The day has come: a change asks why and goes in its log. */
  live: boolean;
  canChange: boolean;
  /** The department whose plan it is; null for every department. */
  departmentId: string | null;
  /** The department a change is made for. */
  departmentFor: string | null;
  diary: Diary;
  hours: Record<string, { week: number; contract: number | null }>;
  pool: { staff: DiaryInput["staff"]; held: readonly Held[]; off: readonly string[]; elsewhere: Record<string, readonly (Span & { label: string })[]> };
  departmentNames: Record<string, string>;
  types: readonly { id: string; name: string }[];
  areas: readonly { name: string; parentName: string | null }[];
  /** Each activity's sub-activities (Admin, Activities), by activity. */
  subActivities: Record<string, readonly { id: string; name: string; when: string; at: number | null; times: readonly number[]; usual: boolean }[]>;
};

export type DiaryState = DiaryData & {
  needs: ReadonlyMap<string, Need>;
  /** For `candidates`: the pool as the model takes it. */
  candidateInput: Pick<DiaryInput, "staff" | "held" | "off" | "elsewhere" | "departmentId" | "date">;
  hoursMap: ReadonlyMap<string, { week: number; contract: number | null }>;
  fill: (needKey: string, span: Span, why?: string | null) => void;
  person: (userId: string) => void;
};

export const DiaryContext = createContext<DiaryState | null>(null);
export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error("useDiary outside the diary");
  return ctx;
}
