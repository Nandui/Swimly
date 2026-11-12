"use client";

import { GraduationCap } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/shadcn/button";
import { formatDate, parseDateOnly } from "@/lib/format";
import { assignRenewal } from "@/modules/qualifications/features/expiring/server/actions";

/** "Assign the course" on an expiring qualification: Training's ordinary assign, due when it
 *  expires. `today` comes from the server, in Europe/Dublin. */
export function AssignRenewal({ courseId, title, userId, name, expiresOn, today }: {
  courseId: string; title: string; userId: string; name: string; expiresOn: string | null; today: string;
}) {
  const due = expiresOn && expiresOn >= today ? expiresOn : null;
  return (
    <ConfirmAction
      trigger={<Button variant="outline" className="min-h-11"><GraduationCap aria-hidden="true" />Assign the course</Button>}
      title={`Assign ${title} to ${name}?`}
      description={due ? `It will be due on ${formatDate(parseDateOnly(due))}, the day their qualification expires.` : "It will have no due date, as their qualification has already expired."}
      confirmLabel="Assign"
      successMessage="Course assigned"
      run={() => assignRenewal(courseId, userId, expiresOn)}
    />
  );
}
