import type { Metadata } from "next";
import { Item } from "@astryxdesign/core/Item";
import { List } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { Heading } from "@astryxdesign/core/Text";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Lead, Num } from "@/components/ui-kit/prose";
import { Tag } from "@/components/ui-kit/tag";
import { ChangePasswordForm } from "@/components/staff/change-password-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { permissionsOf } from "@/lib/authz";
import { pageSession } from "@/lib/page-guards";
import { roleReach } from "@/lib/staff/constants";
import { PERMISSIONS } from "@/lib/staff/permissions";

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

  return (
    <VStack gap={6}>
      <PageHeader title="Account" description="Your sign-in details, and what you may do." />

      <Lead>
        Signed in as <Num>{session.user.name}</Num> ({session.user.email}), on the{" "}
        <Tag color={reach.color}>{session.user.roleName}</Tag> role. Only someone who can manage
        accounts can change your role or your email.
      </Lead>

      <VStack gap={3} as="section">
        <Heading level={2}>What you can do</Heading>
        {granted.length === 0 ? (
          <Lead>
            You can read the screens available to your role. You cannot change their records.
          </Lead>
        ) : (
          <List hasDividers>
            {granted.map((permission) => (
              <Item
                key={permission.key}
                as="li"
                label={permission.label}
                description={permission.description}
              />
            ))}
          </List>
        )}
      </VStack>

      <VStack gap={3} as="section">
        <Heading level={2}>Appearance</Heading>
        <Lead>Light or dark, or whatever your device is set to. Remembered in this browser only.</Lead>
        <ThemeToggle />
      </VStack>

      <VStack gap={3} as="section">
        <Heading level={2}>Change your password</Heading>
        <Lead>
          If someone set the one you are using, change it here — they chose it and it was never
          private. You stay signed in.
        </Lead>
        <ChangePasswordForm />
      </VStack>
    </VStack>
  );
}
