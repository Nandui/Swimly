import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { RolePreviewProvider, type RolePreviewState } from "@/components/staff/role-preview";
import { listRolesForPreview, mayPreview } from "@/lib/staff/preview";

/** Development tooling only: hands every frame's "View as" toggle what it
 *  needs. Outside a dev build, or for someone who may not manage roles, the
 *  toggle gets nothing and renders nothing. */
export async function DevelopmentRolePreview({ session, children }: { session: Session | null; children: ReactNode }) {
  const user = session?.user;
  const preview = user?.preview ?? null;
  let state: RolePreviewState | null = null;
  if (user && mayPreview(preview?.actualPermissions ?? user.permissions, preview?.actualIsSuperadmin ?? user.isSuperadmin)) {
    state = {
      roles: await listRolesForPreview(),
      current: preview ? { id: preview.roleId, name: preview.roleName } : null,
      actualRoleName: preview?.actualRoleName ?? user.roleName,
    };
  }
  return <RolePreviewProvider value={state}>{children}</RolePreviewProvider>;
}
