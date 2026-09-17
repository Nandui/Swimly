import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import type { analyticsPeriod } from "@/lib/analytics/rules";

export function weekLabel(period: ReturnType<typeof analyticsPeriod>) {
  return `${formatDate(parseDateOnly(period.weekStart))} – ${formatDate(parseDateOnly(period.weekEnd))}`;
}

export function ReportUpdated({ at }: { at: string }) {
  return <p className="text-xs text-ui-muted-foreground">Updated {formatDateTime(new Date(at))} · Europe/Dublin</p>;
}
