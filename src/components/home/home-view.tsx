import Link from "next/link";
import { ArrowRight, ChevronRight, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { HOME_ITEM_META } from "@/lib/home-meta";
import type { ModuleManifest } from "@/modules/registry";
import type { HomeItem } from "@/modules/contributions";

/** A role's home page: one card for each module the role has, with what
 *  waits for this person there, and a pointer to Turnfin Me. */
export function HomeView({ homeName, roleName, today, modules, items }: {
  homeName: string;
  roleName: string;
  today: string;
  modules: readonly ModuleManifest[];
  items: ReadonlyMap<string, HomeItem[]>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{homeName}</h1>
        <p className="text-sm text-ui-muted-foreground">{today} · {roleName}</p>
      </header>

      {modules.length === 0 ? (
        <EmptyState icon="keyRound" title="Nothing here yet" hint="Your role has no modules yet. Ask an admin to give it a level in the modules you need." />
      ) : (
        <section className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Your modules">
          {modules.map((mod) => <ModuleCard key={mod.id} mod={mod} items={items.get(mod.id) ?? []} />)}
        </section>
      )}

      <Card className="flex-row items-start gap-3 bg-ui-muted p-5 shadow-none">
        <Smartphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-primary" />
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Your own things are in Turnfin Me</h2>
          <p className="text-sm text-ui-muted-foreground">Your training, required reading, qualifications, shifts and anything HR shares with you. Open Turnfin Me on your phone.</p>
        </div>
      </Card>
    </div>
  );
}

function ModuleCard({ mod, items }: { mod: ModuleManifest; items: HomeItem[] }) {
  const Icon = mod.icon;
  const titleId = `home-${mod.id}`;
  return (
    <Card className="min-w-0 gap-3 p-5 shadow-none" aria-labelledby={titleId}>
      <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-ui-primary" />
        {mod.name}
      </h2>
      {items.length > 0 ? (
        <ul className="-mx-2 flex flex-col">
          {items.map((item) => (
            <li key={`${item.href}:${item.label}`}>
              <Link href={item.href} prefetch={false} className="flex min-h-11 items-center gap-3 rounded-ui-md px-2 py-2 hover:bg-ui-accent focus-visible:outline-2 focus-visible:outline-ui-ring">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {item.label}
                    {item.attention ? (
                      <Tag color={HOME_ITEM_META.attention.color}><TriangleAlert aria-hidden="true" className="size-3" />{HOME_ITEM_META.attention.label}</Tag>
                    ) : null}
                  </span>
                  {item.hint ? <span className="mt-0.5 block text-xs text-ui-muted-foreground">{item.hint}</span> : null}
                </span>
                {item.count !== undefined ? <span className="text-sm font-semibold tabular-nums" aria-label={`${item.count} waiting`}>{item.count}</span> : null}
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ui-muted-foreground">{mod.description}</p>
      )}
      <Button asChild variant="outline" className="mt-auto min-h-11 self-start">
        <Link href={mod.href} prefetch={false}>Open {mod.name}<ArrowRight aria-hidden="true" /></Link>
      </Button>
    </Card>
  );
}
