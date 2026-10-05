import { ItemContent, ItemDescription, Item, ItemGroup, ItemTitle } from "@/components/shadcn/item";

import type { Metadata } from "next";

import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { ChangePasswordForm } from "@/components/staff/change-password-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { permissionsOf } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import { roleReach } from "@/lib/staff/constants";
import { PERMISSIONS } from "@/lib/staff/permissions";
import { PinSettings } from "@/components/devices/session-forms";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Account" };

/** Every signed-in person reaches this, whatever their role. It is the other
 *  half of an admin handing out a password: without it the temporary one is
 *  permanent, and the admin knows it forever.
 *
 *  It also answers "what am I allowed to do?" in the person's own words, which
 *  is otherwise only knowable by trying things and being refused. */
export default async function AccountPage() {
  const session = await pageSession();
  const held = permissionsOf(session);
  const reach = roleReach(session.user.permissions ?? []);
  const granted = PERMISSIONS.filter((permission) => held.has(permission.key));
  const pin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { pinHash: true, pinLockedAt: true } });

  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title="Account"
        description="Your sign-in details, and what you may do."
      />

      <Lead>
        Signed in as <Num>{session.user.name}</Num> ({session.user.email}), on
        the <Tag meta={reach} label={session.user.roleName} /> role. Only
        someone who can manage accounts can change your role or your email.
      </Lead>

      <section className="pc-panel">
        <h2 className="text-lg font-semibold">
          What you can do
        </h2>
        {granted.length === 0 ? (
          <Lead>
            You can read the screens available to your role. You cannot change
            their records.
          </Lead>
        ) : (
          <ItemGroup className="divide-y divide-ui-border">
            {granted.map((permission) => (
              <Item
                key={permission.key}
                role="listitem"
                className="[overflow-wrap:anywhere]"
              >
                <ItemContent className="min-w-0">
                  <ItemTitle>{permission.label}</ItemTitle>
                  <ItemDescription>{permission.description}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </section>

      <section className="pc-panel">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <Lead>
          Light or dark, or whatever your device is set to. Remembered in this
          browser only.
        </Lead>
        <ThemeToggle />
      </section>

      <section className="pc-panel">
        <h2 className="text-lg font-semibold">
          Change your password
        </h2>
        <Lead>
          If someone set the one you are using, change it here: they chose it
          and it was never private. You stay signed in.
        </Lead>
        <ChangePasswordForm />
      </section>

      <section className="pc-panel">
        <h2 className="text-lg font-semibold">Quick-switch PIN</h2>
        <Lead>
          On a shared reception computer or poolside tablet, tap your name and enter this PIN
          instead of your password. It only works on devices registered as shared, and only after
          you have signed in there once with your password. HR and other restricted records still
          ask for your password.
        </Lead>
        <PinSettings hasPin={!!pin?.pinHash} locked={!!pin?.pinLockedAt} />
      </section>
    </div>
  );
}
