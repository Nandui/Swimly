import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { PortalFrame } from "@/components/portal/portal-frame";
import { RotaWarningTag } from "@/components/rota/status";
import { formatDate } from "@/lib/format";
import { pageSession } from "@/lib/page-guards";
import { clock } from "@/lib/rota/constants";
import { myShifts } from "@/lib/rota/mine";

export const metadata: Metadata = { title: { absolute: "My shifts · Turnfin" } };

/** The signed-in person's shifts for the next four weeks. No Rota permission
 *  is needed and nobody else's shifts appear. */
export default async function MyShiftsPage() {
  const session = await pageSession();
  const shifts = await myShifts(session.user.id, 28);
  return (
    <PortalFrame userName={session.user.name ?? "Staff member"} moduleName="My shifts">
      <div className="space-y-2">
        <Button asChild variant="ghost" className="-ml-3 min-h-11"><Link href="/me?view=me"><ArrowLeft aria-hidden="true" />My hub</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight">My shifts</h1>
        <p className="text-sm text-ui-muted-foreground">The next four weeks. If a shift needs a qualification you no longer hold, tell your manager before the day.</p>
      </div>
      <Card className="gap-3 p-5 shadow-none" aria-label="Your shifts">
        {shifts.length === 0 ? <p className="text-sm text-ui-muted-foreground">No shifts in the next four weeks.</p> : (
          <ul className="divide-y divide-ui-border">
            {shifts.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 space-y-1">
                  <span className="block font-medium">{formatDate(s.date)} · <span className="tabular-nums">{clock(s.startMinutes)}–{clock(s.endMinutes)}</span></span>
                  <span className="block text-sm text-ui-muted-foreground">{s.role} at {s.site.name}{s.requiredType ? ` · needs ${s.requiredType.name}` : ""}{s.note ? ` · ${s.note}` : ""}</span>
                </span>
                {s.warnings.map((w) => <RotaWarningTag key={w} warning={w} />)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalFrame>
  );
}
