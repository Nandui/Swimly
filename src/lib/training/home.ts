import "server-only";
import { certificateQueue } from "@/lib/training/certificates";
import { expiringQualifications, signoffCount } from "@/lib/training/data";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Training on the home page, for trainers and training managers. Everyone
 *  completes their own training in Turnfin Me. */
registerHomeCard({
  moduleId: "training",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    const items: HomeItem[] = [];
    if (held.has("training.signoff")) {
      const waiting = await signoffCount();
      items.push({ label: "Practical sign-offs", hint: "Confirm skills shown in person", href: "/training/sign-off", count: waiting, attention: waiting > 0 });
    }
    if (held.has("qualifications.manage")) {
      const [pending, expiring] = await Promise.all([certificateQueue("PENDING"), expiringQualifications()]);
      items.push({ label: "Certificates to check", hint: "Uploaded in Turnfin Me", href: "/training/certificates", count: pending.rows.length, attention: pending.rows.length > 0 });
      items.push({ label: "Qualifications expiring", hint: "Expired or due soon", href: "/training/expiring", count: expiring.rows.length, attention: expiring.rows.length > 0 });
    }
    return items;
  },
});
