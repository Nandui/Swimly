import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isStaging } from "@/lib/deployment";
import { auth } from "@/auth";
import { AppChrome } from "@/components/app-nav";
import { RolePreviewBar } from "@/components/staff/role-preview";
import { permissionsOf } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { listRolesForPreview, mayPreview } from "@/lib/staff/preview";
import { homePathFor, visibleScreens } from "@/lib/staff/screens";

/** The signed-in shell: a side nav that stays put on desktop, a bar and a
 *  drawer below `md`, and a centred content column. No top bar on desktop, no
 *  breadcrumb, no card around the page. The shell itself is a client
 *  component; this layout only decides what goes in it. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  // Memoised per request, so the pages inside asking again cost nothing.
  const { club, clubs } = await getCurrentClub();

  // The dev build's "see the app as" bar: for an account that may manage
  // roles, or one already wearing a preview and needing the way back. The
  // gate inside `mayPreview` is shut on production, so this is null there.
  const preview = session.user.preview ?? null;
  const showPreview = mayPreview(preview?.actualPermissions ?? session.user.permissions);
  const previewRoles = showPreview ? await listRolesForPreview() : [];

  return (
    <AppChrome
      userName={session.user.name ?? session.user.email ?? "Unknown"}
      userSubtitle={session.user.roleName}
      // The wordmark goes where the role's day starts, same as the sign-in.
      homeHref={homePathFor(session.user.home, session.user.permissions, session.user.screens)}
      screens={visibleScreens(session.user.screens, permissionsOf(session))}
      club={club}
      clubs={clubs}
      banner={
        isStaging() ? <p className="workspace-staging-notice">Staging · Changes here update live records.</p> : showPreview ? (
          <RolePreviewBar
            roles={previewRoles}
            current={preview ? { id: preview.roleId, name: preview.roleName } : null}
            actualRoleName={preview?.actualRoleName ?? session.user.roleName}
          />
        ) : null
      }
    >
      {children}
    </AppChrome>
  );
}
