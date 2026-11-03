import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, registerSubjectRecords } from "@/modules/contributions";
import { certificateQueue } from "@/modules/qualifications/features/certificates/server/queue";
import { expiringCount } from "@/modules/qualifications/features/expiring/server/data";
import { hoursRecords } from "@/modules/qualifications/features/me/server/records";

/** Qualifications' registration plug (AGENTS.md, The app contract), loaded by
 *  src/modules/server.ts: its home card and a person's in-service hours for HR's subject export.
 *  Its menu entry, levels and permissions are in manifest.ts. */

registerSubjectRecords({ key: "inServiceHours", load: hoursRecords });

registerHomeCard({
  moduleId: "qualifications",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("qualifications.manage")) return [];
    const [pending, expiring] = await Promise.all([certificateQueue("PENDING"), expiringCount()]);
    return [
      { label: "Certificates to check", hint: "Uploaded in Turnfin Me", href: "/staff-qualifications/certificates", count: pending.rows.length, attention: pending.rows.length > 0 },
      { label: "Qualifications expiring", hint: "Expired or due soon", href: "/staff-qualifications", count: expiring, attention: expiring > 0 },
    ];
  },
});
