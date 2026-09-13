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
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: AppIconName;
  compact?: boolean;
}) {
  return (
    <Empty className={compact ? "py-6" : "py-12"}>
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon">
            <AppIcon name={icon} />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {hint ? <EmptyDescription>{hint}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
