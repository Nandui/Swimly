"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { parentAdminRequest, parentDateTime, PARENT_ACCOUNT_META, saveParentAdmin, type ManagedParentAccount } from "@/lib/parent/admin-client";
import { ParentFormDialog, ParentReason } from "./parent-fields";

export function ParentAccounts() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ email: string; account: ManagedParentAccount | null }>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const searching = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const account = result?.account;
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching.current) return;
    searching.current = true;
    const query = email.trim().toLowerCase();
    setPending(true); setError(""); setResult(undefined);
    try {
      const data = await parentAdminRequest<{ account: ManagedParentAccount | null }>(`accounts?${new URLSearchParams({ email: query })}`);
      setResult({ email: query, account: data.account });
    } catch (error) { setError(error instanceof Error ? error.message : "Could not find the account. Try again."); }
    finally {
      searching.current = false; setPending(false);
      requestAnimationFrame(() => resultRef.current?.focus());
    }
  }
  return <div className="max-w-3xl space-y-6">
    <form onSubmit={search} className="flex flex-wrap items-end gap-3" aria-label="Find a parent account" aria-busy={pending}>
      <Input type="email" name="email" label="Parent email" value={email} onChange={setEmail} required maxLength={254}
        autoComplete="off" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-[1_1_16rem] [&_input]:min-h-11" disabled={pending}
        description="Enter the full address used to sign in to LeisureWorld Aquatics." />
      <LoadingButton type="submit" className="min-h-11" pending={pending} pendingLabel="Searching…">Find account</LoadingButton>
    </form>
    <div ref={resultRef} tabIndex={-1} className="space-y-4 rounded-ui-lg focus-visible:outline-2 focus-visible:outline-ui-ring" aria-live="polite">
      {error ? <Notice tone="error" title={error} /> : null}
      {result && !account ? <div className="space-y-2 rounded-ui-lg border border-dashed border-ui-border p-6">
        <h2 className="text-xl font-semibold">No account found</h2>
        <p className="break-all text-sm font-medium">{result.email}</p>
        <p className="text-sm text-ui-muted-foreground">Check the address. A parent account is created when they first verify a sign-in code. You can approve their email on a swimmer’s profile before they sign in.</p>
      </div> : null}
      {account ? <section className="space-y-4 border-y border-ui-border py-6" aria-labelledby="parent-account-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2"><h2 id="parent-account-heading" className="break-words text-xl font-semibold">{account.name || "Parent account"}</h2><p className="break-all text-sm">{account.email}</p></div>
          <Badge variant="secondary" data-tone={PARENT_ACCOUNT_META[account.isActive ? "active" : "suspended"].color}>{PARENT_ACCOUNT_META[account.isActive ? "active" : "suspended"].label}</Badge>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-ui-muted-foreground">Phone</dt><dd className="mt-1 break-words">{account.phone || "Not provided"}</dd></div>
          <div><dt className="text-ui-muted-foreground">Account created</dt><dd className="mt-1">{parentDateTime(account.createdAt)}</dd></div>
        </dl>
        <p className="text-sm text-ui-muted-foreground">{account.isActive ? "Suspending blocks sign-in and ends all current sessions, across both sites and every linked swimmer." : "Reactivating allows sign-in again. Previously revoked swimmer access stays revoked; the parent must sign in again."}</p>
        <ParentFormDialog key={account.id}
          trigger={<Button variant="outline" className="min-h-11">{account.isActive ? "Suspend account" : "Reactivate account"}</Button>}
          title={account.isActive ? "Suspend parent account" : "Reactivate parent account"}
          description={account.isActive ? `Block ${account.email} from signing in and end their current sessions. This affects all their linked swimmers at both sites.`
            : `Allow ${account.email} to sign in again. This does not restore any revoked swimmer access.`}
          submitLabel={account.isActive ? "Suspend account" : "Reactivate account"}
          successMessage={account.isActive ? "Parent account suspended." : "Parent account reactivated."}
          submit={data => saveParentAdmin(`accounts/${encodeURIComponent(account.id)}`, "PATCH", { isActive: !account.isActive, reason: String(data.get("reason") ?? "") })}
          onSuccess={() => setResult({ email: account.email, account: { ...account, isActive: !account.isActive } })}>
          <p className="break-all rounded-ui-md bg-ui-muted p-3 text-sm font-medium">{account.email}</p><ParentReason />
        </ParentFormDialog>
      </section> : null}
    </div>
    {!result && !pending && !error ? <p className="text-sm text-ui-muted-foreground">Parent accounts are shared across both sites. To approve or revoke access to one swimmer, open that swimmer’s Parent access tab.</p> : null}
  </div>;
}
