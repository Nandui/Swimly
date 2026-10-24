import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SwitchApp } from "@/components/apps/switch-app";
import { appSwitchList } from "@/lib/apps/data";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Apps" };

/** Which apps are on, and where (docs/architecture.md, App switches): each app on everywhere,
 *  off, or on only at some sites. Superadmins only, so no role can give it; every change is in
 *  the activity log. Admin itself is always on and is not listed. */
export default async function AppsPage() {
  const session = await pageSession();
  if (!session.user.isSuperadmin) notFound();
  const { groups, sites } = await appSwitchList(session.user.orgId ?? null);

  return (
    <PageShell header={<PageHeader
        title="Apps"
        description="Which apps are on, and at which sites. A new app can start at one site; an app that is off leaves the menus, Home and its pages there, and nothing in it is deleted."
      />}>
      {groups.map((group) => (
        <section key={group.key} className="pc-panel" aria-labelledby={`apps-${group.key}`}>
          <div className="pc-panel-head">
            <h2 id={`apps-${group.key}`} className="text-lg font-semibold">{group.label}</h2>
          </div>
          <ul className="pc-rows">
            {group.apps.map((app) => (
              <li key={app.id} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true"><app.icon /></span>
                <div className="pc-row-body">
                  <span className="pc-row-title">{app.name}</span>
                  <span className="pc-row-hint">{app.where}</span>
                </div>
                <div className="pc-row-trail">
                  <SwitchApp app={{ id: app.id, name: app.name, state: app.state, siteIds: app.siteIds }} sites={sites} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
