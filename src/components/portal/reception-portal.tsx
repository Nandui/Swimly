import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, ClipboardList, HelpCircle, Search, UserPlus, Users, WavesLadder, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Tag } from "@/components/ui-kit/tag";
import { AddSwimmer } from "@/components/students/add-swimmer";
import { ClubSwitcher } from "@/components/clubs/club-switcher";
import { PortalFrame } from "@/components/portal/portal-frame";
import { STAFF_MODULES, moduleStatusMeta } from "@/lib/modules";
import type { ReceptionPortalAccess } from "@/lib/reception-portal";
import type { CurrentClub } from "@/lib/clubs/current";

const taskIcons: Record<string, LucideIcon> = { swimmers: Search, classes: CalendarDays, add: UserPlus, assessments: ClipboardList, siblings: Users };

/** Approved module-directory composition. One Aquatics row groups its tasks
 * and handoffs; other modules extend the catalogue underneath. */
export function ReceptionPortal({ userName, club, clubs, access }: {
  userName: string;
  club: CurrentClub;
  clubs: CurrentClub[];
  access: ReceptionPortalAccess;
}) {
  const modules = STAFF_MODULES.filter(module => module.reception && module.id !== "swimly" && (module.id !== "docs" || access.docs) && (module.id !== "refunds" || access.refunds));
  return <PortalFrame reception userName={userName}>
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reception Portal</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">Your tools for helping customers and keeping the desk running.</p>
      </div>
      <div className="w-full space-y-2 sm:w-64 sm:shrink-0">
        <p className="text-xs font-medium">Working site</p>
        <ClubSwitcher club={club} clubs={clubs} touchTargets />
      </div>
    </div>
    <section className="space-y-4" aria-label="Reception modules">
      {access.aquatics && <Card className="gap-0 overflow-hidden p-0 shadow-none">
        <div className="grid lg:grid-cols-3">
          <div className="space-y-4 border-b border-ui-border p-5 sm:p-6 lg:border-r lg:border-b-0">
            <WavesLadder className="size-7 text-ui-primary" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Aquatics</h2>
            <p className="text-sm leading-relaxed text-ui-muted-foreground">Swimmers, lessons and everything the swim-school desk needs.</p>
            <Button asChild className="min-h-11 w-full justify-between"><Link href="/start?workspace=desk" prefetch={false}>Open Aquatics<ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <div className="p-3 sm:p-4 lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {access.tasks.map(task => {
                const Icon = taskIcons[task.id];
                const content = <><Icon className="size-5 text-ui-muted-foreground" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block font-medium">{task.label}</span><span className="mt-1 block text-xs font-normal leading-relaxed text-ui-muted-foreground">{task.description}</span></span><ChevronRight className="text-ui-muted-foreground" aria-hidden="true" /></>;
                const className = "h-auto min-h-16 justify-start gap-3 whitespace-normal px-3 py-3 text-left";
                return task.id === "add"
                  ? <AddSwimmer key={task.id} trigger={<Button variant="ghost" className={className}>{content}</Button>} />
                  : <Button key={task.id} asChild variant="ghost" className={className}><Link href={task.href} prefetch={false}>{content}</Link></Button>;
              })}
            </div>
            {access.tasks.length === 0 && <p className="p-3 text-sm leading-relaxed text-ui-muted-foreground">Open Aquatics to see the pages available to you.</p>}
          </div>
        </div>
        {access.followUp.length > 0 && <nav aria-label="Aquatics follow-up" className="flex flex-wrap gap-x-2 gap-y-1 border-t border-ui-border px-3 py-3 sm:px-5">
          {access.followUp.map(item => <Button key={item.id} asChild variant="ghost" className="min-h-11 text-xs"><Link href={item.href} prefetch={false}>{item.label}<ArrowUpRight aria-hidden="true" /></Link></Button>)}
        </nav>}
      </Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map(module => {
          const Icon = module.icon;
          const status = moduleStatusMeta[module.status];
          return <Card key={module.id} className="gap-5 p-5 shadow-none sm:p-6">
            <div className="flex items-start gap-4"><Icon className="mt-1 size-6 shrink-0 text-ui-muted-foreground" aria-hidden="true" /><div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{module.name}</h2><Tag color={status.color}>{status.label}</Tag></div>
              <p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">{module.id === "docs" ? "Procedures, policies and the documents you need at the desk." : module.description}</p>
            </div></div>
            {module.status === "available" ? <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="min-h-11"><Link href={module.href} prefetch={false}>Open {module.name}<ArrowUpRight aria-hidden="true" /></Link></Button>
              {module.id === "docs" && <Button asChild variant="ghost" className="min-h-11"><Link href="/docs/work" prefetch={false}>My reading</Link></Button>}
            </div> : <p className="text-xs leading-relaxed text-ui-muted-foreground">This module will appear here when it is ready.</p>}
          </Card>;
        })}
      </div>
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-4">
      <p className="break-words text-xs text-ui-muted-foreground">Signed in as <span className="font-medium text-ui-foreground">{userName}</span></p>
      <div className="flex flex-wrap gap-1">
        <Button asChild variant="ghost" className="min-h-11"><Link href="/help"><HelpCircle aria-hidden="true" />Help centre</Link></Button>
        <Button asChild variant="ghost" className="min-h-11"><Link href="/modules?view=all">All modules<ArrowUpRight aria-hidden="true" /></Link></Button>
      </div>
    </footer>
  </PortalFrame>;
}
