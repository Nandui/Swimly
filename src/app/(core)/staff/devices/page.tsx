import type { Metadata } from "next";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { BackLink } from "@/components/ui-kit/back-link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { ForgetThisDevice, RegisterThisDevice, RevokeDevice } from "@/components/devices/device-actions";
import { currentSharedDevice } from "@/lib/devices/shared-device";
import { SHARED_IDLE_MINUTES } from "@/lib/devices/constants";
import { formatDateTime } from "@/lib/format";
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
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href="/staff" current="Work devices">Staff</BackLink>
      <PageHeader
        title="Work devices"
        description="The centre's computers and tablets where staff do their work."
        actions={here ? <ForgetThisDevice /> : <RegisterThisDevice sites={sites} />}
      />
      <Lead>
        Turnfin Work is for work PCs: once the rule is switched on, staff without the “Work from any device”
        permission can only sign in to Work on a device registered here. Personal records are never on Work;
        staff use Turnfin Me on their own phone for those. A single person’s office PC can be registered too.
      </Lead>
      <Lead>
        On a shared device people tap their name and enter their personal PIN instead of a password,
        and it returns to the switch screen after {SHARED_IDLE_MINUTES} idle minutes. HR and other
        restricted records always ask for the password again. {here ? `This browser is ${here.name}.` : "This browser is not shared."}
      </Lead>
      {devices.length === 0 ? (
        <EmptyState icon="users" title="No work devices yet" hint="Open Turnfin on the reception computer or tablet, sign in, and register it here." />
      ) : (
        <ItemGroup className="divide-y divide-ui-border">
          {devices.map((device) => {
            const status = device.revokedAt ? DEVICE_STATUS_META.revoked : device.id === here?.id ? DEVICE_STATUS_META.this : null;
            return (
              <Item key={device.id} role="listitem" className="items-start">
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex-wrap">
                    <span>{device.name}</span>
                    {status ? <Tag meta={status} /> : null}
                  </ItemTitle>
                  <ItemDescription>
                    {device.clubId ? siteName.get(device.clubId) ?? "Removed site" : "Any site"} · {device._count.people} {device._count.people === 1 ? "person" : "people"} can switch in
                    {device.lastUsedAt ? ` · last used ${formatDateTime(device.lastUsedAt)}` : ""}
                  </ItemDescription>
                </ItemContent>
                {!device.revokedAt ? <ItemActions><RevokeDevice id={device.id} name={device.name} /></ItemActions> : null}
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </div>
  );
}
