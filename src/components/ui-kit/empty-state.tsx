import { EmptyState as WorkspaceEmptyState } from "@/components/workspace/feedback";
import { AppIcon, type AppIconName } from "@/components/ui-kit/app-icon";

/** A place with nothing in it yet: one line saying what, one saying what to
 *  do, and the action that does it. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  compact = false,
}: {
  icon?: AppIconName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  /** Inside a section rather than as the whole page. */
  compact?: boolean;
}) {
  return (
    <WorkspaceEmptyState
      icon={icon ? <AppIcon name={icon} size="lg" color="secondary" /> : undefined}
      title={title}
      description={hint}
      actions={action}
      isCompact={compact}
    />
  );
}
