import { FlaskConical } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Marks a swimmer, and each of their places, searched at a level they are not at. */
export const WHAT_IF_META = { label: "What if", color: "blue", icon: FlaskConical } as const satisfies StatusMeta;
