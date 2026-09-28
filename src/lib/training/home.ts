import "server-only";
import { certificateQueue } from "@/lib/training/certificates";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Training on the home page, for trainers and training managers. Everyone
 *  completes their own training in Turnfin Me. */
registerHomeCard({
  moduleId: "training",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    const items: HomeItem[] = [];
    if (held.has("training.signoff")) items.push({ label: "Practical sign-offs", hint: "Confirm skills shown in person", href: "/training/sign-off" });
    if (held.has("qualifications.manage")) {
      const pending = (await certificateQueue("PENDING")).rows.length;
      items.push({ label: "Certificates to check", href: "/training/certificates", count: pending, attention: pending > 0 });
      items.push({ label: "Expiring qualifications", href: "/training/expiring" });
    }
    if (held.has("training.manage") || held.has("training.assign")) items.push({ label: "Courses and assigning", href: "/training/courses" });
    return items;
  },
});
