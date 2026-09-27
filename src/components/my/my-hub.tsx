import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { PortalFrame } from "@/components/portal/portal-frame";
import type { ModuleManifest } from "@/modules";
import type { MySection } from "@/modules/my/hub";

/** The personal hub: what needs you across every module, then the apps you
 *  can open. Everything here is the person's own; managing others happens
 *  inside each app. */
export function MyHub({ userName, sections, modules, receptionAllowed }: {
  userName: string;
  sections: MySection[];
  modules: readonly ModuleManifest[];
  receptionAllowed: boolean;
}) {
  const first = userName.split(" ")[0] || userName;
  const waiting = sections.reduce((sum, s) => sum + (s.ok ? s.items.filter((item) => item.needsAction).length : 0), 0);
  return (
    <PortalFrame userName={userName} moduleName="My hub">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Hello, {first}</h1>
        <p className="text-sm text-ui-muted-foreground">
          {waiting === 0 ? "Nothing needs you right now." : `${waiting} ${waiting === 1 ? "thing needs" : "things need"} you across Turnfin.`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2" aria-label="Your work">
        {sections.map((section) => (
          <Card key={section.id} className="gap-3 p-5 shadow-none" aria-labelledby={`${section.id}-heading`}>
            <h2 id={`${section.id}-heading`} className="text-lg font-semibold">{section.title}</h2>
            {!section.ok ? (
              <Notice tone="warning" title={`Couldn't load ${section.title.toLowerCase()}`} description="Try again in a moment. Everything else on this page is up to date." />
            ) : section.items.length === 0 ? (
              <p className="text-sm text-ui-muted-foreground">{section.empty}</p>
            ) : (
              <ul className="divide-y divide-ui-border">
                {section.items.map((item) => {
                  const body = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold [overflow-wrap:anywhere]">{item.title}</span>
                        {item.detail ? <span className="block text-sm text-ui-muted-foreground">{item.detail}</span> : null}
                      </span>
                      {item.status ? <Tag color={item.status.color}>{item.status.label}</Tag> : null}
                      {item.href ? <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" /> : null}
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link href={item.href} prefetch={false} className="-mx-2 flex min-h-12 items-center gap-3 rounded-ui-md px-2 py-2 hover:bg-ui-muted/50">{body}</Link>
                      ) : (
                        <div className="flex min-h-12 items-center gap-3 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {section.more ? (
              <Link href={section.more.href} prefetch={false} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium underline-offset-4 hover:underline">
                {section.more.label}<ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </Card>
        ))}
      </div>

      <section className="space-y-3" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="text-lg font-semibold">Your apps</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Button key={module.id} asChild variant="outline" className="h-auto min-h-16 justify-start gap-3 whitespace-normal p-4 text-left">
                <Link href={module.href} prefetch={false}>
                  <Icon aria-hidden="true" className="size-6 shrink-0 text-ui-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{module.name}</span>
                    <span className="block text-sm font-normal text-ui-muted-foreground">{module.description}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                </Link>
              </Button>
            );
          })}
          {receptionAllowed ? (
            <Button asChild variant="outline" className="h-auto min-h-16 justify-start gap-3 p-4">
              <Link href="/reception-portal">Reception Portal<ArrowRight aria-hidden="true" /></Link>
            </Button>
          ) : null}
        </div>
      </section>
    </PortalFrame>
  );
}
