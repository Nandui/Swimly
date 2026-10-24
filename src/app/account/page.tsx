import type { Metadata } from "next";
import { CircleCheck, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { ChangePasswordForm } from "@/components/staff/change-password-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { PinSettings } from "@/components/devices/session-forms";
import { pageSession } from "@/lib/page-guards";
import { PERSON_STATUS_META } from "@/lib/people/constants";
import { prisma } from "@/lib/prisma";
import { googleSignInAvailable } from "@/lib/google-sign-in";
import { recentlyConfirmed } from "@/lib/policy/engine";
import { currentActor } from "@/lib/policy/session";
import { roleReach } from "@/lib/staff/constants";
import { WORK_ANYWHERE, cleanLevels, levelLines, levelsFromAccess } from "@/lib/staff/levels";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Account" };

/** Every signed-in person reaches this, whatever their role. Where people sign
 *  in with a password (no Google, or the developer login) it is the other half
 *  of an admin handing one out: without it the temporary one is permanent, and
 *  the admin knows it forever. Password and PIN come first.
 *
 *  It also answers "what am I allowed to do?" in the person's own words: one
 *  line per module, the level and what it means, from the same helper as
 *  Roles and the person page. */
export default async function AccountPage() {
  const session = await pageSession();
  const [pin, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { pinHash: true, pinLockedAt: true, passwordHash: true } }),
    // The worn role, so "View as" shows the role being previewed.
    session.user.roleId
      ? prisma.staffRole.findUnique({ where: { id: session.user.roleId }, select: { levels: true, extras: true, permissions: true, screens: true } })
      : null,
  ]);
  const levels = role ? (role.levels !== null ? cleanLevels(role.levels, role.extras) : levelsFromAccess(role.permissions, role.screens).role) : null;
  const lines = levels ? levelLines(levels) : [];
  const icons = new Map(allModules().map((mod) => [mod.id, mod.icon]));
  const reach = roleReach(session.user.permissions ?? []);
  // With Google set up, only an account that has a password (the developer login) keeps one to change.
  const google = googleSignInAvailable() && session.user.authMethod !== "password";
  const showPassword = !googleSignInAvailable() || !!pin?.passwordHash;
  const proof = !google ? "password" : session.user.authMethod === "google" && recentlyConfirmed(await currentActor()) ? "google" : "google-again";

  return (
    <PageShell header={<PageHeader
        title="Account"
        description={
          <>
            Signed in as {session.user.name} ({session.user.email}), on the{" "}
            <Tag meta={reach} label={session.user.roleName} /> role.
          </>
        }
      />}>

      <div className="grid gap-4 items-start grid-cols-columns">
        {showPassword ? (
          <section className="pc-panel" aria-labelledby="password-heading">
            <div className="pc-panel-head">
              <h2 id="password-heading" className="text-lg font-semibold">Change your password</h2>
            </div>
            <ChangePasswordForm />
          </section>
        ) : null}

        <section className="pc-panel" aria-labelledby="pin-heading">
          <div className="pc-panel-head">
            <h2 id="pin-heading" className="text-lg font-semibold">Quick-switch PIN</h2>
          </div>
          <p className="pc-row-hint">
            Use it to switch in quickly on a work device. It only works on work devices, and only after you have
            signed in there once {google ? "with Google" : "with your password"}. HR and other restricted records still ask you to
            {google ? " sign in with Google again" : " confirm your password"}.
          </p>
          <PinSettings hasPin={!!pin?.pinHash} locked={!!pin?.pinLockedAt} proof={proof} />
        </section>
      </div>

      <section className="pc-panel" aria-labelledby="appearance-heading">
        <div className="pc-panel-head">
          <h2 id="appearance-heading" className="text-lg font-semibold">Appearance</h2>
        </div>
        <ThemeToggle />
      </section>

      <section className="pc-panel" aria-labelledby="can-do-heading">
        <div className="pc-panel-head">
          <h2 id="can-do-heading" className="text-lg font-semibold">What you can do</h2>
        </div>
        <ul className="pc-rows">
          {session.user.isSuperadmin ? (
            <li className="pc-row">
              <span className="pc-tile-icon" aria-hidden="true"><ShieldCheck /></span>
              <div className="pc-row-body">
                <span className="pc-row-title">{PERSON_STATUS_META.superadmin.label}</span>
                <span className="pc-row-hint">Everything in the organisation, HR included</span>
              </div>
            </li>
          ) : null}
          {lines.map((line) => {
            const Icon = icons.get(line.moduleId) ?? CircleCheck;
            return (
              <li key={line.moduleId} className="pc-row">
                <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                <div className="pc-row-body">
                  <span className="pc-row-title">{line.module}: {line.level}</span>
                  <span className="pc-row-hint">{line.help}</span>
                  {line.ticks.map((tick) => <span key={tick.label} className="pc-row-hint">{tick.label} · {tick.help}</span>)}
                </div>
              </li>
            );
          })}
          {levels?.extras.includes(WORK_ANYWHERE) ? (
            <li className="pc-row">
              <span className="pc-tile-icon" aria-hidden="true"><CircleCheck /></span>
              <div className="pc-row-body">
                <span className="pc-row-title">Can work away from the centre&apos;s computers</span>
                <span className="pc-row-hint">You can sign in to Turnfin from any device, for example a phone.</span>
              </div>
            </li>
          ) : null}
          {lines.length === 0 && !session.user.isSuperadmin ? (
            <li className="pc-row" data-muted="">
              <div className="pc-row-body"><span className="pc-row-title">No modules</span></div>
            </li>
          ) : null}
        </ul>
        <p className="pc-row-hint">
          Swim school, Training and Rota apply at the sites you work at. Only someone who can manage accounts can change
          your role or your email.
        </p>
      </section>
    </PageShell>
  );
}
