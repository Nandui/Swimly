"use client";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ActionButton, ConfirmAction } from "@/components/confirm-action";
import { copyTaskTemplate, setTaskTemplateArchived } from "@/modules/tasks/features/templates/server/actions";

/** Start a similar template from this one, as a new draft. `compact`: a row's icon button. */
export function CopyTemplate({ id, compact = false }: { id: string; compact?: boolean }) {
  const router = useRouter();
  return (
    <ActionButton variant="outline" size={compact ? "icon" : "default"} ariaLabel="Copy this template as a new draft" title={compact ? "Copy" : undefined} successMessage="Copied as a new draft"
      run={async () => {
        const r = await copyTaskTemplate(id);
        if (r.ok && r.id) router.push(`/tasks/templates/${r.id}`);
        return r;
      }}><Copy aria-hidden="true" />{compact ? null : "Copy"}</ActionButton>
  );
}

/** Archive (it makes no more tasks) or restore as a draft. `compact`: a row's icon button. */
export function ArchiveTemplate({ id, archived, compact = false }: { id: string; archived: boolean; compact?: boolean }) {
  const router = useRouter();
  if (archived) {
    return (
      <ActionButton variant={compact ? "outline" : "default"} size={compact ? "icon" : "default"} ariaLabel="Restore this template as a draft" title={compact ? "Restore" : undefined} successMessage="Restored as a draft"
        run={async () => { const r = await setTaskTemplateArchived(id, false); if (r.ok) router.refresh(); return r; }}><ArchiveRestore aria-hidden="true" />{compact ? null : "Restore"}</ActionButton>
    );
  }
  return (
    <ConfirmAction
      trigger={compact
        ? <Button variant="outline" size="icon" aria-label="Archive this template" title="Archive"><Archive aria-hidden="true" /></Button>
        : <Button variant="ghost"><Archive aria-hidden="true" />Archive</Button>}
      title="Archive this template?"
      description="It makes no more tasks. Tasks it already made stay, with everything recorded on them. You can restore it as a draft."
      confirmLabel="Archive"
      successMessage="Template archived"
      run={async () => { const r = await setTaskTemplateArchived(id, true); if (r.ok) router.refresh(); return r; }}
    />
  );
}
