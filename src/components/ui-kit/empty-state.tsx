import type { LucideIcon } from "lucide-react";
import { EmptyState as AstryxEmptyState } from "@astryxdesign/core/EmptyState";

/** A place with nothing in it yet: one line saying what, one saying what to
 *  do, and the action that does it. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <AstryxEmptyState
      icon={Icon ? <Icon className="size-6" strokeWidth={1.5} aria-hidden /> : undefined}
      title={title}
      description={hint}
      actions={action}
    />
  );
}
