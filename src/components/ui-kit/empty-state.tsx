import type { LucideIcon } from "lucide-react";
import { EmptyState as AstryxEmptyState } from "@astryxdesign/core/EmptyState";

/** A place with nothing in it yet: one line saying what, one saying what to
 *  do, and the action that does it. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  /** Inside a section rather than as the whole page. */
  compact?: boolean;
}) {
  return (
    <AstryxEmptyState
      icon={Icon ? <Icon className="size-6" strokeWidth={1.5} aria-hidden /> : undefined}
      title={title}
      description={hint}
      actions={action}
      isCompact={compact}
    />
  );
}
