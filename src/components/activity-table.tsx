import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/shadcn/table";
import { cn } from "@/lib/utils";

import { Tag } from "@/components/ui-kit/tag";
import { actionMeta } from "@/lib/activity/constants";
import type { ActivityEntry } from "@/lib/activity/data/audit-log";
import { formatDateTime } from "@/lib/format";

/** The audit trail as rows.
 *
 *  Below `lg` the actor and the timestamp leave their columns and re-home as a
 *  supporting line under the summary, rather than pushing the table into a
 *  sideways scroll that hides them. */
export function ActivityTable({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Table className="w-full [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">What happened</TableHead>
          <TableHead scope="col" className={"max-lg:hidden"}>
            Who
          </TableHead>
          <TableHead scope="col" className={"max-lg:hidden"}>
            Action
          </TableHead>
          <TableHead scope="col" className={"max-lg:hidden"}>
            When
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const meta = actionMeta(entry.action);
          return (
            <TableRow key={entry.id}>
              {/* Summaries carry email addresses and member numbers, which
                  cannot break on their own; without this one of them makes
                  the table wider than a phone. */}
              <TableCell className={"[overflow-wrap:anywhere]"}>
                <span className="text-sm text-ui-foreground font-medium">
                  {entry.summary}
                </span>
                <span
                  className={cn(
                    "text-sm text-ui-muted-foreground block",
                    "lg:hidden",
                  )}
                >
                  {entry.actorName} · {formatDateTime(entry.createdAt)}
                </span>
                <Tag color={meta.color} className="lg:hidden">
                  {meta.label}
                </Tag>
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                <span className="text-sm text-ui-muted-foreground">
                  {entry.actorName}
                </span>
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
              <TableCell className={"max-lg:hidden"}>
                <span
                  className={
                    "text-sm text-ui-muted-foreground whitespace-nowrap tabular-nums"
                  }
                >
                  {formatDateTime(entry.createdAt)}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
