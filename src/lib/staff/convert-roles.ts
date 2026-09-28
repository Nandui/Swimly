import { logAudit } from "@/lib/audit";
import type { prisma as Db } from "@/lib/prisma";
import { describeLevels, levelsFromAccess, roleColumns } from "@/lib/staff/levels";

export type RoleConversion = {
  id: string;
  name: string;
  people: number;
  levels: string;
  gains: string[];
  losses: string[];
  /** Written (or, in a dry run, would be written). */
  converted: boolean;
};

/** Converts every role that still holds screens and permissions into levels
 *  (docs/how-turnfin-works.md). For each module it takes the lowest level that
 *  covers everything the role held there. A role that would lose anything is
 *  never written; one that would gain is written only with `allowGains`, after
 *  the owner has reviewed the dry run. */
export async function convertRolesToLevels(db: typeof Db, options: { confirm: boolean; allowGains: boolean }): Promise<RoleConversion[]> {
  // A handful of rows: filter in code rather than through Prisma's JSON null.
  const roles = (await db.staffRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, permissions: true, screens: true, levels: true, _count: { select: { users: true } } },
  })).filter((role) => role.levels === null);
  const report: RoleConversion[] = [];
  for (const role of roles) {
    const conversion = levelsFromAccess(role.permissions, role.screens);
    const converted = conversion.losses.length === 0 && (options.allowGains || conversion.gains.length === 0);
    report.push({ id: role.id, name: role.name, people: role._count.users, levels: describeLevels(conversion.role), gains: conversion.gains, losses: conversion.losses, converted });
    if (!converted || !options.confirm) continue;
    const columns = roleColumns(conversion.role);
    await db.$transaction(async (tx) => {
      await tx.staffRole.update({
        where: { id: role.id },
        data: { levels: columns.levels, extras: columns.extras, permissions: columns.permissions, screens: columns.screens, restricted: columns.restricted },
      });
      await logAudit({
        actorId: null,
        actorName: "Operator script",
        action: "convert-to-levels",
        entity: "StaffRole",
        entityId: role.id,
        clubId: null,
        summary: `Converted role ${role.name} to levels: ${describeLevels(conversion.role)}${conversion.gains.length ? `. Gained: ${conversion.gains.join(", ")}` : ""}`,
      }, tx);
    });
  }
  return report;
}
