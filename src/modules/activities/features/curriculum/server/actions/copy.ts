"use server";
import { fail, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
export async function copyProgramme(_programmeId: string, _targetClubId: string): Promise<ActionResult> {
  await requirePermission("curriculum.manage");
  void _programmeId;
  void _targetClubId;
  return fail("Programmes are now shared across all sites. Reload to use the shared curriculum; no copy is needed.");
}
