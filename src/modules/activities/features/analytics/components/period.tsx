import { formatDateRange, formatDateTime } from "@/lib/format";
import type { analyticsPeriod } from "@/modules/activities/features/analytics/server/rules";

export function weekLabel(period: ReturnType<typeof analyticsPeriod>) {
  return formatDateRange(period.weekStart, period.weekEnd);
}

export function ReportUpdated({ at }: { at: string }) {
  return <p className="text-xs text-ui-muted-foreground">Updated {formatDateTime(new Date(at))} · Europe/Dublin</p>;
}
