import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, ClipboardList, HelpCircle, Search, UserPlus, Users, WavesLadder, ListChecks, type LucideIcon } from "lucide-react";
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
const followUpHints: Record<string, string> = {
  enrolment: "Class places and family follow-ups",
  moves: "Swimmers ready for their next class",
  agreements: "Check Legend billing agreements",
  parents: "Review requests for parent access",
};

export function ReceptionPortal({ userName, club, clubs, access }: {
  userName: string; club: CurrentClub; clubs: CurrentClub[]; access: ReceptionPortalAccess;
}) {
  const modules = STAFF_MODULES.filter(module => module.reception && module.id !== "swimly" && (module.id !== "docs" || access.docs) && (module.id !== "refunds" || access.refunds));
  const available = modules.filter(module => module.status === "available");
  const planned = modules.filter(module => module.status === "planned");
  return <PortalFrame reception userName={userName}>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reception Portal</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">Help a customer, follow up with a family, or find what you need.</p>
      </div>
      <div className="w-full space-y-2 sm:w-72 sm:shrink-0">
        <p className="text-xs font-medium text-ui-muted-foreground">Working site</p>
        <ClubSwitcher club={club} clubs={clubs} touchTargets />
      </div>
    </div>
    <section className="grid min-w-0 gap-4 lg:grid-cols-3" aria-label="Reception modules">
      {access.aquatics && <Card className={`min-w-0 gap-0 overflow-hidden p-0 shadow-none ${access.followUp.length ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ui-border bg-ui-brand-soft/50 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3"><WavesLadder className="size-6 shrink-0 text-ui-primary" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Aquatics</h2><p className="mt-1 text-sm text-ui-muted-foreground">Everyday swim-school tasks</p></div></div>
          <Button asChild variant="outline" className="min-h-11"><Link href="/start?workspace=desk" prefetch={false}>Open Aquatics<ArrowUpRight aria-hidden="true" /></Link></Button>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
          {access.tasks.map(task => {
            const Icon = taskIcons[task.id];
            const content = <><span className="flex size-10 shrink-0 items-center justify-center rounded-ui-lg bg-ui-brand-soft text-ui-primary"><Icon className="size-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-medium">{task.label}</span><span className="mt-1 block text-xs font-normal leading-relaxed text-ui-muted-foreground">{task.description}</span></span><ChevronRight className="shrink-0 text-ui-muted-foreground" aria-hidden="true" /></>;
            const className = "h-auto min-h-24 w-full justify-start gap-3 whitespace-normal px-3 py-4 text-left";
            return task.id === "add"
              ? <AddSwimmer key={task.id} trigger={<Button variant="ghost" className={className}>{content}</Button>} />
              : <Button key={task.id} asChild variant="ghost" className={className}><Link href={task.href} prefetch={false}>{content}</Link></Button>;
          })}
          {access.tasks.length === 0 && <p className="p-3 text-sm leading-relaxed text-ui-muted-foreground">Open Aquatics to see the pages available to you.</p>}
        </div>
      </Card>}
      {access.aquatics && access.followUp.length > 0 && <Card className="min-w-0 gap-4 bg-ui-brand-soft/40 p-5 shadow-none sm:p-6">
        <div className="flex items-center gap-3"><ListChecks aria-hidden="true" className="size-5 text-ui-primary" /><h2 className="text-xl font-semibold">Follow up</h2></div>
        <p className="text-sm text-ui-muted-foreground">Pick up the next step with families.</p>
        <nav aria-label="Aquatics follow-up" className="divide-y divide-ui-brand-border/40">
          {access.followUp.map(item => <Button key={item.id} asChild variant="ghost" className="h-auto min-h-20 w-full justify-between gap-3 whitespace-normal px-0 py-3 text-left"><Link href={item.href} prefetch={false}><span><span className="block font-medium">{item.label}</span><span className="mt-1 block text-xs font-normal text-ui-muted-foreground">{followUpHints[item.id]}</span></span><ArrowRight aria-hidden="true" /></Link></Button>)}
        </nav>
      </Card>}
      {available.length > 0 && <div className={`grid min-w-0 gap-4 lg:col-span-3 ${available.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {available.map(module => {
          const Icon = module.icon;
          return <Card key={module.id} className="min-w-0 gap-4 p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-3"><Icon className="size-6 shrink-0 text-ui-primary" aria-hidden="true" /><h2 className="text-xl font-semibold">{module.name}</h2></div>
            <p className="max-w-prose text-sm leading-relaxed text-ui-muted-foreground">{module.id === "docs" ? "Procedures, policies and required reading for your team." : module.description}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Button asChild className="min-h-11"><Link href={module.href} prefetch={false}>Open {module.name}<ArrowRight aria-hidden="true" /></Link></Button>
              {module.id === "docs" && <Button asChild variant="ghost" className="min-h-11"><Link href="/docs/work" prefetch={false}>My reading<ArrowUpRight aria-hidden="true" /></Link></Button>}
            </div>
          </Card>;
        })}
      </div>}
      {planned.map(module => <div key={module.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2 text-sm lg:col-span-3"><span className="font-medium">{module.name}</span><Tag color={moduleStatusMeta[module.status].color}>{moduleStatusMeta[module.status].label}</Tag><span className="text-ui-muted-foreground">{module.description}</span></div>)}
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
