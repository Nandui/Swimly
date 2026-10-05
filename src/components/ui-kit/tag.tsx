import { Badge } from "@/components/shadcn/badge";
import type { StatusMeta } from "@/lib/status";

/** The only way to show a status: the meta supplies the words, tone and icon.
 *  `label` overrides the words for dynamic text that keeps the meta's meaning
 *  (a count, a role or level name, a short form); `className` is for layout only. */
export function Tag({ meta, label, className }: { meta: StatusMeta; label?: React.ReactNode; className?: string }) {
  const Icon = meta.icon;
  return (
    <Badge data-tone={meta.color} className={className}>
      <Icon aria-hidden="true" />
      {label ?? meta.label}
    </Badge>
  );
}
