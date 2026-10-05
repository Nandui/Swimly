import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/shadcn/empty";
import { AppIcon, type AppIconName } from "./app-icon";

/** The only empty state in Turnfin (DESIGN.md, "States"): the round icon tile,
 *  a 600 title, one plain hint and at most one action. On the canvas it is a
 *  white panel (poolside.css); inside a panel or card it sits flat. `as` makes
 *  the title a heading when the empty state stands in for a section or page. */
export function EmptyState({
  title,
  hint,
  action,
  icon,
  compact = false,
  as: Heading,
  role,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  icon?: AppIconName;
  compact?: boolean;
  as?: "h1" | "h2" | "h3";
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
        <EmptyTitle className={compact ? "text-sm" : undefined}>{Heading ? <Heading className="text-[length:inherit] leading-[inherit]">{title}</Heading> : title}</EmptyTitle>
        {hint ? <EmptyDescription>{hint}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
