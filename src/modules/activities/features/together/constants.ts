import { ArrowRightLeft, CircleCheck, FlaskConical, TrendingUp, UserRoundPlus } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Marks a swimmer, and each of their places, searched at a level they are not at. */
export const WHAT_IF_META = { label: "What if", color: "blue", icon: FlaskConical } as const satisfies StatusMeta;

/** What "Move them here" does to each child, said on their row before anything happens. */
export const MOVE_META = {
  stays: { label: "Stays as they are", color: "gray", icon: CircleCheck },
  moves: { label: "Changes class", color: "blue", icon: ArrowRightLeft },
  level: { label: "Changes level", color: "purple", icon: TrendingUp },
  joins: { label: "New place", color: "green", icon: UserRoundPlus },
} as const satisfies Record<string, StatusMeta>;
