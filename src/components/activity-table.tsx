import { Tag } from "@/components/ui-kit/tag";
import { actionMeta } from "@/lib/activity/constants";
import type { ActivityEntry } from "@/lib/activity/data/audit-log";
import { formatDateTime } from "@/lib/format";

/** A database-style table: hairlines, a warm-grey header, no shadow.
 *
 *  Below `md` the actor and the timestamp leave their columns and re-home as a
 *  muted second line under the summary, rather than pushing the table into a
 *  sideways scroll that hides them. */
export function ActivityTable({ entries }: { entries: ActivityEntry[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              What happened
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium text-muted-foreground max-md:hidden"
            >
              Who
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Action
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-right text-xs font-medium text-muted-foreground max-md:hidden"
            >
              When
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const meta = actionMeta(entry.action);
            return (
              <tr
                key={entry.id}
                className="group border-b transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-3 py-2 font-medium text-foreground">
                  {entry.summary}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground md:hidden">
                    {entry.actorName} · {formatDateTime(entry.createdAt)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground max-md:hidden">{entry.actorName}</td>
                <td className="px-3 py-2">
                  <Tag color={meta.color}>{meta.label}</Tag>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground max-md:hidden">
                  {formatDateTime(entry.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
