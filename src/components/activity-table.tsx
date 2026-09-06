import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { Tag } from "@/components/ui-kit/tag";
import { actionMeta } from "@/lib/activity/constants";
import type { ActivityEntry } from "@/lib/activity/data/audit-log";
import { formatDateTime } from "@/lib/format";

/** The audit trail as rows.
 *
 *  Below `md` the actor and the timestamp leave their columns and re-home as a
 *  supporting line under the summary, rather than pushing the table into a
 *  sideways scroll that hides them. */
export function ActivityTable({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Table hasHover textOverflow="wrap">
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell scope="col">What happened</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            Who
          </TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">Action</TableHeaderCell>
          <TableHeaderCell scope="col" className="max-md:hidden">
            When
          </TableHeaderCell>
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
              <TableCell className="[overflow-wrap:anywhere]">
                <Text weight="medium">{entry.summary}</Text>
                <Text type="supporting" display="block" className="md:hidden">
                  {entry.actorName} · {formatDateTime(entry.createdAt)}
                </Text>
                <Tag color={meta.color} className="md:hidden">{meta.label}</Tag>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary">{entry.actorName}</Text>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Tag color={meta.color}>{meta.label}</Tag>
              </TableCell>
              <TableCell className="max-md:hidden">
                <Text color="secondary" textWrap="nowrap" hasTabularNumbers>
                  {formatDateTime(entry.createdAt)}
                </Text>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
