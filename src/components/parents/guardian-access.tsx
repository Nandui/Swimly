"use client";

import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Input } from "@/components/ui/input";
import { PARENT_ACCESS_META, parentDateTime, saveParentAdmin, type GuardianAccess } from "@/lib/parent/admin-client";
import { ParentFormDialog, ParentLoadState, ParentReason } from "./parent-fields";
import { useParentResource } from "./use-parent-resource";

export function GuardianAccessPanel({ studentId, swimmerName }: { studentId: string; swimmerName: string }) {
  const path = `children/${encodeURIComponent(studentId)}/access`;
  const resource = useParentResource<{ items: GuardianAccess[] }>(path);
  function saved() {
    resource.reload();
    requestAnimationFrame(() => document.getElementById("parent-access-heading")?.focus());
  }
  return <section className="space-y-6" aria-labelledby="parent-access-heading">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-prose space-y-2">
        <h2 id="parent-access-heading" tabIndex={-1} className="text-xl font-semibold">Parent access</h2>
        <p className="text-sm text-ui-muted-foreground">Approve the email a parent or guardian uses to sign in to LeisureWorld Aquatics. Access follows {swimmerName} across both sites.</p>
      </div>
      {resource.data ? <AccessForm path={path} swimmerName={swimmerName} onSaved={saved} /> : null}
    </div>
    <ParentLoadState {...resource} />
    {resource.data ? <>
      {resource.data.items.length ? <ul className="divide-y divide-ui-border border-y border-ui-border">
        {resource.data.items.map(item => {
          const meta = PARENT_ACCESS_META[item.revokedAt ? "revoked" : "approved"];
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-all text-sm font-medium">{item.parentEmail}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" data-tone={meta.color}>{meta.label}</Badge>
                <span className="text-xs text-ui-muted-foreground">Updated {parentDateTime(item.updatedAt)}</span>
              </div>
            </div>
            <AccessForm path={path} swimmerName={swimmerName} entry={item} onSaved={saved} />
          </li>;
        })}
      </ul> : <div className="space-y-2 rounded-ui-lg border border-dashed border-ui-border p-6">
        <h3 className="font-medium">No parent access approved</h3>
        <p className="text-sm text-ui-muted-foreground">Contact details alone do not grant access. Approve each guardian’s email after checking it belongs to the right person.</p>
      </div>}
      <div className="max-w-prose space-y-2 text-sm text-ui-muted-foreground">
        <p>Parents see released progress and bookings. Competency changes appear the next day at midnight in Ireland. Internal and medical notes stay private.</p>
        <p>Approval does not send an email. The guardian signs in to LeisureWorld Aquatics with the approved address.</p>
        <Button variant="link" className="min-h-11 px-0" asChild><Link href="/students/parents">Find or manage a parent account</Link></Button>
      </div>
    </> : null}
  </section>;
}

function AccessForm({ path, swimmerName, entry, onSaved }: { path: string; swimmerName: string; entry?: GuardianAccess; onSaved: () => void }) {
  const revoke = entry && !entry.revokedAt;
  const label = revoke ? "Revoke access" : entry ? "Restore access" : "Approve parent email";
  return <ParentFormDialog
    trigger={<Button variant={entry ? "outline" : "default"} className="min-h-11">{label}</Button>}
    title={label}
    description={revoke ? `Remove ${entry.parentEmail}’s access to ${swimmerName}. Access to other swimmers stays unchanged.`
      : `Allow this guardian to see ${swimmerName}’s released progress and bookings in LeisureWorld Aquatics.`}
    submitLabel={label} successMessage={revoke ? "Parent access revoked." : "Parent access approved."}
    submit={data => saveParentAdmin(path, revoke ? "DELETE" : "PUT", {
      email: entry?.parentEmail ?? String(data.get("email") ?? "").trim().toLowerCase(), reason: String(data.get("reason") ?? ""),
    })} onSuccess={onSaved}>
    <div className="space-y-1 rounded-ui-md bg-ui-muted p-3 text-sm"><p className="font-medium break-words">{swimmerName}</p>{entry ? <p className="break-all">{entry.parentEmail}</p> : null}</div>
    {!entry ? <Input type="email" name="email" label="Guardian email" required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} /> : null}
    <ParentReason />
  </ParentFormDialog>;
}
