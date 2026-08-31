import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ChangePasswordForm } from "@/components/staff/change-password-form";
import { pageSession } from "@/lib/page-guards";
import { ROLE_BLURB, ROLE_META } from "@/lib/staff/constants";

export const metadata: Metadata = { title: "Account" };

/** Every signed-in person reaches this, whatever their tier. It is the other
 *  half of an admin handing out a password: without it the temporary one is
 *  permanent, and the admin knows it forever. */
export default async function AccountPage() {
  const session = await pageSession();
  const role = session.user.role;

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Your sign-in details." />

      <p className="max-w-prose text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-medium text-foreground">{session.user.name}</span> (
        {session.user.email}
        ), with the <Tag color={ROLE_META[role].color}>{ROLE_META[role].label}</Tag> role:{" "}
        {ROLE_BLURB[role].charAt(0).toLowerCase() + ROLE_BLURB[role].slice(1)} Only an admin can
        change your role or your email.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Change your password</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          If an admin set the one you are using, change it here — they chose it and it was never
          private. You stay signed in.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
