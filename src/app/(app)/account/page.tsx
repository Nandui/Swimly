import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
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
    <div className="space-y-6">
      <PageHeader title="Account" description="Your sign-in details, and what you may do." />

      <p className="max-w-prose text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{session.user.name}</span> (
        {session.user.email}), on the{" "}
        <Tag color={reach.color}>{session.user.roleName}</Tag> role. Only someone who can manage
        accounts can change your role or your email.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">What you can do</h2>
        {granted.length === 0 ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            You can look things up and change nothing. Swimmers, classes, the curriculum and$
            attendance are all readable.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-md border">
            {granted.map((permission) => (
              <li key={permission.key} className="border-b p-3 last:border-0">
                <p className="text-sm font-medium text-foreground">{permission.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{permission.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Light or dark, or whatever your device is set to. Remembered in this browser only.
        </p>
        <ThemeToggle />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Change your password</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          If someone set the one you are using, change it here — they chose it and it was never
          private. You stay signed in.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
