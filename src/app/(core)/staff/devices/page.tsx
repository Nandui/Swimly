import type { Metadata } from "next";
import { MonitorSmartphone } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ForgetThisDevice, RegisterThisDevice, RevokeDevice } from "@/components/devices/device-actions";
import { currentSharedDevice } from "@/lib/devices/shared-device";
import { SHARED_IDLE_MINUTES } from "@/lib/devices/constants";
import { formatDateTime, plural } from "@/lib/format";
import { screenPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { DEVICE_STATUS_META } from "@/lib/devices/meta";

export const metadata: Metadata = { title: "Work devices" };

export default async function DevicesPage() {
  const session = await screenPage("staff", "staff.manage");
  const orgId = session.user.orgId ?? undefined;
  const [devices, sites, here] = await Promise.all([
    prisma.sharedDevice.findMany({
      where: { orgId }, orderBy: [{ revokedAt: "asc" }, { name: "asc" }],
      select: { id: true, name: true, clubId: true, createdAt: true, lastUsedAt: true, revokedAt: true, _count: { select: { people: true } } },
    }),
    prisma.club.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    currentSharedDevice(),
  ]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  return (
    <div className="min-w-0 flex flex-col gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Staff" }}
        title="Work devices"
        description="The centre's computers and tablets where staff do their work."
        actions={here ? <ForgetThisDevice /> : <RegisterThisDevice sites={sites} />}
      />
      <section className="pc-panel" aria-label="Work devices">
        <p className="text-sm text-ui-muted-foreground">
          On a work device, staff switch in with their PIN. It signs out after {SHARED_IDLE_MINUTES} idle minutes.
          {" "}{here ? `This browser is ${here.name}.` : "This browser is not a work device."}
        </p>
        {devices.length === 0 ? (
          <EmptyState icon="monitor" title="No work devices yet" hint="Open Turnfin on the reception computer or tablet, sign in, and register it here." />
        ) : (
          <ul className="pc-rows">
            {devices.map((device) => {
              const status = device.revokedAt ? DEVICE_STATUS_META.revoked : device.id === here?.id ? DEVICE_STATUS_META.this : null;
              return (
                <li key={device.id} className="pc-row" data-muted={device.revokedAt ? "" : undefined}>
                  <span className="pc-tile-icon" aria-hidden="true"><MonitorSmartphone /></span>
                  <div className="pc-row-body">
                    <span className="pc-row-title">{device.name}</span>
                    <span className="pc-row-hint">
                      {device.clubId ? siteName.get(device.clubId) ?? "Removed site" : "Any site"} · {plural(device._count.people, "person", "people")} can switch in
                      {device.lastUsedAt ? ` · last used ${formatDateTime(device.lastUsedAt)}` : ""}
                    </span>
                  </div>
                  {status || !device.revokedAt ? (
                    <div className="pc-row-trail">
                      {status ? <Tag meta={status} /> : null}
                      {!device.revokedAt ? <RevokeDevice id={device.id} name={device.name} /> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
