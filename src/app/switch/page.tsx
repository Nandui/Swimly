import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuickSwitch } from "@/components/devices/session-forms";
import { currentSharedDevice } from "@/lib/devices/shared-device";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Switch user" };

/** The shared-device front door. Lists only the people who have signed in on
 *  this device with their password and set a PIN; anyone else signs in with
 *  their email. A browser that is not a registered shared device goes to the
 *  ordinary sign-in. */
export default async function SwitchPage() {
  const device = await currentSharedDevice();
  if (!device) redirect("/sign-in");
  const people = await prisma.sharedDeviceUser.findMany({
    where: { deviceId: device.id, user: { isActive: true, pinHash: { not: null }, orgId: device.orgId } },
    orderBy: { lastUsedAt: "desc" },
    take: 30,
    select: { user: { select: { id: true, name: true } } },
  });
  return <QuickSwitch device={device.name} people={people.map((p) => p.user)} />;
}
