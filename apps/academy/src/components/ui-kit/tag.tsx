import { Badge } from "@/components/shadcn/badge";
import type { LucideIcon } from "lucide-react";

/** What a Tag shows. `StatusMeta` (lib/status.ts) has this shape; the UI kit declares its own
 *  because it may not import the platform, and the compiler keeps the two in step. */
export type TagMeta = { label: string; color: "green" | "blue" | "orange" | "red" | "purple" | "gray"; icon: LucideIcon };

/** The only way to show a status: the meta supplies the words, tone and icon.
 *  `label` overrides the words for dynamic text that keeps the meta's meaning
 *  (a count, a role or level name, a short form); `className` is for layout only. */
export function Tag({ meta, label, className }: { meta: TagMeta; label?: React.ReactNode; className?: string }) {
  const Icon = meta.icon;
  return (
    <Badge data-tone={meta.color} className={className}>
      <Icon aria-hidden="true" />
      {label ?? meta.label}
    </Badge>
  );
}
