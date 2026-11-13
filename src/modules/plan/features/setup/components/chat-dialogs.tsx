"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { FormDialog } from "@/components/form-dialog";
import { fail } from "@/lib/action-result";
import { chatSpacesToLink, linkChatSpace, unlinkChatSpace } from "@/modules/plan/features/setup/server/chat-actions";
import { ChoiceField } from "@/modules/plan/shared/components/fields";

const P = "turnfin-module";
type Found = { state: "loading" } | { state: "error"; error: string } | { state: "ready"; spaces: { space: string; name: string }[] };

/** Link a department to one of the Google Chat spaces Turnfin's Chat app has been added to. The
 *  list is read from Google when the dialog opens. */
export function LinkSpaceDialog({ siteId, departmentId, department, current }: { siteId: string; departmentId: string; department: string; current: string | null }) {
  const router = useRouter();
  const [found, setFound] = useState<Found>({ state: "loading" });
  const [space, setSpace] = useState("");
  function open() {
    setFound({ state: "loading" });
    setSpace(current ?? "");
    chatSpacesToLink(siteId).then((r) => setFound(r.ok ? { state: "ready", spaces: r.spaces } : { state: "error", error: r.error }),
      () => setFound({ state: "error", error: "Google Chat didn't answer. Try again in a moment." }));
  }
  return (
    <FormDialog portalClassName={P} trigger={<Button variant="outline" className="min-h-11">{current ? "Change" : "Link a space"}</Button>}
      title={`${department}'s Google Chat space`} description="Requests to cover a gap for this department are posted there, and its members can answer."
      submitLabel="Link" successMessage="Space linked" onOpen={open} onSuccess={() => router.refresh()}
      submit={async () => space ? linkChatSpace({ siteId, departmentId, space }) : fail("Choose a space.")}>
      {found.state === "loading" ? <p role="status" className="text-sm text-ui-muted-foreground">Looking in Google Chat</p>
        : found.state === "error" ? <p role="alert" className="text-sm text-ui-destructive">{found.error}</p>
        : found.spaces.length === 0 ? <p className="text-sm text-ui-muted-foreground">Turnfin isn&apos;t in any space yet. In Google Chat, open the department&apos;s space, choose Apps and integrations, and add Turnfin. Then come back here.</p>
        : <ChoiceField id={`plan-chat-space-${departmentId}`} label="Space" value={space} onChange={setSpace} empty="Choose a space"
            options={found.spaces.map((s) => ({ id: s.space, name: s.name }))} hint="Only spaces Turnfin has been added to are listed." />}
    </FormDialog>
  );
}

export function UnlinkSpaceDialog({ siteId, departmentId, department }: { siteId: string; departmentId: string; department: string }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={P} trigger={<Button variant="ghost" className="min-h-11">Unlink</Button>} destructive cancelLabel="Keep it"
      title={`Unlink ${department}'s space?`} description="Nobody can be asked to cover for this department in Google Chat until a space is linked again."
      submitLabel="Unlink" successMessage="Space unlinked" onSuccess={() => router.refresh()} submit={() => unlinkChatSpace({ siteId, departmentId })}>
      {null}
    </FormDialog>
  );
}
