import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { PortalFrame } from "@/components/portal/portal-frame";
import { TrainingStatusTag } from "@/components/training/status";
import { formatDate } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { myTraining } from "@/lib/training/mine";

export const metadata: Metadata = { title: { absolute: "My training · Turnfin" } };

/** Everyone's own training, open first, then finished. Needs no Training
 *  permission and shows nobody else's records. */
export default async function MyTrainingPage() {
  const session = await pageSession();
  const rows = await myTraining(session.user.id);
  const open = rows.filter((row) => row.state !== "completed");
  const done = rows.filter((row) => row.state === "completed");
  const list = (items: typeof rows, empty: string) => items.length === 0
    ? <p className="text-sm text-ui-muted-foreground">{empty}</p>
    : <ul className="divide-y divide-ui-border">{items.map((row) => (
      <li key={row.id}>
        <Link href={`/me/training/${row.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-ui-muted/50">
          <span className="min-w-0 space-y-1">
            <span className="block font-medium">{row.course.title}</span>
            <span className="block text-sm text-ui-muted-foreground">
              {row.completedAt && row.state === "completed" ? `Completed ${formatDate(row.completedAt)}` : row.dueOn ? `Due ${formatDate(row.dueOn)}` : "No deadline"}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2"><TrainingStatusTag state={row.state} /><ArrowRight aria-hidden="true" className="size-4 text-ui-muted-foreground" /></span>
        </Link>
      </li>
    ))}</ul>;
  return (
    <PortalFrame userName={session.user.name ?? "Staff member"} moduleName="My training">
      <div className="space-y-2">
        <Button asChild variant="ghost" className="-ml-3 min-h-11"><Link href="/me?view=me"><ArrowLeft aria-hidden="true" />My hub</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight">My training</h1>
        <p className="text-sm text-ui-muted-foreground">Courses assigned to you. Open one to read the material and mark it done.</p>
      </div>
      <Card className="gap-3 p-5 shadow-none" aria-labelledby="open-training">
        <h2 id="open-training" className="text-lg font-semibold">To do</h2>
        {list(open, "No training to do right now.")}
      </Card>
      <Card className="gap-3 p-5 shadow-none" aria-labelledby="done-training">
        <h2 id="done-training" className="text-lg font-semibold">Completed</h2>
        {list(done, "Nothing completed yet.")}
      </Card>
    </PortalFrame>
  );
}
