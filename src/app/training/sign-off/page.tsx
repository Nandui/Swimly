import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/shadcn/item";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ReturnForPractice, SignOff } from "@/components/training/manage-actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { signoffQueue } from "@/lib/training/data";

export const metadata: Metadata = { title: "Sign-off" };

/** Practical training waiting for a trainer, for the people this trainer
 *  covers. Their own never appears: someone else signs that off. */
export default async function TrainingSignoffPage() {
  const { who, rows } = await signoffQueue();
  if (!who.signoff) notFound();
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title="Sign-off" description="People who say they are ready. Watch them do it, then sign it off or send it back with what to practise." />
      {rows.length === 0 ? (
        <EmptyState icon="clipboardCheck" title="Nobody is waiting" hint="Practical training appears here when someone you cover asks for sign-off." />
      ) : (
        <ItemGroup className="divide-y divide-ui-border rounded-ui-lg border border-ui-border">
          {rows.map((row) => (
            <Item key={row.id} role="listitem" className="items-start rounded-none">
              <ItemContent className="min-w-0 gap-1">
                <p className="font-medium"><Link href={`/training/people/${row.user.id}`} className="underline-offset-4 hover:underline">{row.user.name}</Link>{row.user.jobTitle ? <span className="text-sm font-normal text-ui-muted-foreground"> · {row.user.jobTitle}</span> : null}</p>
                <p className="text-sm">{row.course.title}{row.course.grantsType ? ` · records ${row.course.grantsType.name}` : ""}</p>
                <p className="text-xs text-ui-muted-foreground">Ready since {row.submittedAt ? formatDateTime(row.submittedAt) : "unknown"}{row.dueOn ? ` · due ${formatDate(row.dueOn)}` : ""}</p>
                {row.learnerNote ? <p className="text-sm"><span className="font-medium">Their note: </span>{row.learnerNote}</p> : null}
              </ItemContent>
              <ItemActions className="flex-wrap">
                <SignOff id={row.id} name={row.user.name} title={row.course.title} />
                <ReturnForPractice id={row.id} name={row.user.name} title={row.course.title} />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
