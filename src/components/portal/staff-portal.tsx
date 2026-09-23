import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Tag } from "@/components/ui-kit/tag";
import { PortalFrame } from "@/components/portal/portal-frame";
import { STAFF_MODULES, moduleStatusMeta } from "@/lib/modules";
import { RECEPTION_PORTAL_PATH } from "@/lib/reception-portal";

/** The general portal remains available to every staff role. */
export function StaffPortal({ userName, docsAllowed = false, refundsAllowed = false, aquaticsAllowed = true, receptionAllowed = false }: {
  userName: string;
  docsAllowed?: boolean;
  refundsAllowed?: boolean;
  aquaticsAllowed?: boolean;
  receptionAllowed?: boolean;
}) {
  return <PortalFrame userName={userName}>
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Choose your workspace</h1>
      <p className="text-sm text-ui-muted-foreground">Your LeisureWorld apps, in one place.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Staff modules">
      {STAFF_MODULES.filter(module => (module.id !== "docs" || docsAllowed) && (module.id !== "refunds" || refundsAllowed) && (module.id !== "swimly" || aquaticsAllowed)).map(module => {
        const status = moduleStatusMeta[module.status];
        const Icon = module.icon;
        return <Card key={module.id} className="gap-6 p-6 shadow-none">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Icon className="size-8 text-ui-muted-foreground" aria-hidden="true" />
            <Tag color={status.color}>{status.label}</Tag>
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-xl font-semibold">{module.name}</h2>
            <p className="text-sm leading-relaxed text-ui-muted-foreground">{module.description}</p>
          </div>
          {module.status === "available" && <Button asChild className="min-h-11 w-full justify-between">
            <Link href={module.href} prefetch={false}>Open {module.name}<ArrowRight aria-hidden="true" /></Link>
          </Button>}
        </Card>;
      })}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="break-words text-sm text-ui-muted-foreground">Signed in as <span className="font-medium text-ui-foreground">{userName}</span></p>
      {receptionAllowed && <Button asChild variant="ghost" className="min-h-11"><Link href={RECEPTION_PORTAL_PATH}>Reception Portal<ArrowRight aria-hidden="true" /></Link></Button>}
    </div>
  </PortalFrame>;
}
