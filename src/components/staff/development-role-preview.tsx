import type { Session } from "next-auth";
import { RolePreviewBar } from "@/components/staff/role-preview";
import { listRolesForPreview, mayPreview } from "@/lib/staff/preview";

/** Development tooling only; never part of either production workspace. */
export async function DevelopmentRolePreview({ session }: { session: Session }) {
  const preview = session.user.preview ?? null;
  if (!mayPreview(preview?.actualPermissions ?? session.user.permissions)) return null;
  const roles = await listRolesForPreview();
  return <RolePreviewBar roles={roles}
    current={preview ? { id: preview.roleId, name: preview.roleName } : null}
    actualRoleName={preview?.actualRoleName ?? session.user.roleName} />;
}
