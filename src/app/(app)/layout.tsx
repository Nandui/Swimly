import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { AppChrome } from "@/components/app-nav";
import { RolePreviewBar } from "@/components/staff/role-preview";
import { permissionsOf } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { listRolesForPreview, mayPreview } from "@/lib/staff/preview";
import { homePathFor, visibleScreens } from "@/lib/staff/screens";
import { NAV_COLLAPSED_COOKIE } from "@/lib/shell-preferences";

/** The signed-in grouped workspace. Authentication and screen access stay
 *  here; the client shell owns navigation, utilities and responsive layout. */
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
  const collapsed = (await cookies()).get(NAV_COLLAPSED_COOKIE)?.value === "1";

  return (
    <AppChrome
      userName={session.user.name ?? session.user.email ?? "Unknown"}
      userSubtitle={session.user.roleName}
      // The wordmark goes where the role's day starts, same as the sign-in.
      homeHref={homePathFor(session.user.home, session.user.permissions, session.user.screens)}
      screens={visibleScreens(session.user.screens, permissionsOf(session))}
      club={club}
      clubs={clubs}
      initialCollapsed={collapsed}
      banner={
        showPreview ? (
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
