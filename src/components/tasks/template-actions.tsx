"use client";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { copyTaskTemplate, setTaskTemplateArchived } from "@/lib/tasks/actions";

/** Start a similar template from this one, as a new draft. */
export function CopyTemplate({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionButton variant="outline" size="default" ariaLabel="Copy this template as a new draft" successMessage="Copied as a new draft"
      run={async () => {
        const r = await copyTaskTemplate(id);
        if (r.ok && r.id) router.push(`/tasks/templates/${r.id}`);
        return r;
      }}><Copy aria-hidden="true" />Copy</ActionButton>
  );
}

/** Archive (it makes no more tasks) or restore as a draft. */
export function ArchiveTemplate({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  if (archived) {
    return (
      <ActionButton variant="default" size="default" ariaLabel="Restore this template as a draft" successMessage="Restored as a draft"
        run={async () => { const r = await setTaskTemplateArchived(id, false); if (r.ok) router.refresh(); return r; }}><ArchiveRestore aria-hidden="true" />Restore</ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={<Button variant="ghost"><Archive aria-hidden="true" />Archive</Button>}
      title="Archive this template?"
      description="It makes no more tasks. Tasks it already made stay, with everything recorded on them. You can restore it as a draft."
      confirmLabel="Archive"
      successMessage="Template archived"
      run={async () => { const r = await setTaskTemplateArchived(id, true); if (r.ok) router.refresh(); return r; }}
    />
  );
}
