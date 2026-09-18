import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { AppIcon, type AppIconName } from "./app-icon";
export function EmptyState({
  title,
  hint,
  action,
  icon,
  compact = false,
  role,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: AppIconName;
  compact?: boolean;
  role?: "status";
}) {
  return (
    <Empty role={role} className={compact ? "gap-3 px-4 py-6 md:px-4 md:py-6" : "py-12"}>
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon">
            <AppIcon name={icon} />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className={compact ? "text-sm" : undefined}>{title}</EmptyTitle>
        {hint ? <EmptyDescription>{hint}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
