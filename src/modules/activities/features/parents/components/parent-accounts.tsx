"use client";

import { useRef, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { parentAdminRequest, parentDateTime, PARENT_ACCOUNT_META, saveParentAdmin, type ManagedParentAccount } from "@/modules/activities/shared/parents/admin-client";
import { ParentFormDialog, ParentReason } from "@/modules/activities/shared/parents/components/parent-fields";

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
  return <div className="flex flex-col gap-4">
    <form onSubmit={search} className="flex flex-wrap items-end gap-3" aria-label="Find a parent account" aria-busy={pending}>
      <Input type="email" name="email" label="Parent email" value={email} onChange={setEmail} required maxLength={254}
        autoComplete="off" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-[1_1_16rem] max-w-[27.5rem] [&_input]:min-h-11" disabled={pending} />
      <LoadingButton type="submit" className="min-h-11" pending={pending} pendingLabel="Searching…"><Search aria-hidden="true" />Find account</LoadingButton>
    </form>
    <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-3 rounded-ui-lg focus-visible:outline-2 focus-visible:outline-ui-ring" aria-live="polite">
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      {result && !account ? <EmptyState
        as="h3"
        icon="userSearch"
        title="No account found"
        hint={<><span className="mb-1 block break-all font-semibold text-ui-foreground">{result.email}</span>Check the address. A parent account is created when they first verify a sign-in code. You can approve their email on a swimmer’s profile before they sign in.</>}
      /> : null}
      {account ? <section aria-labelledby="parent-account-heading" className="flex flex-col gap-3">
        <div className="pc-row">
          <span className="pc-tile-icon"><UserRound aria-hidden="true" /></span>
          <div className="pc-row-body basis-56">
            <h3 id="parent-account-heading" className="pc-row-title break-all">{account.name || account.email}</h3>
            {account.name ? <p className="pc-row-hint break-all">{account.email}</p> : null}
            <p className="pc-row-hint">Phone {account.phone || "not provided"} · Account created {parentDateTime(account.createdAt)}</p>
          </div>
          <div className="pc-row-trail">
            <Tag meta={PARENT_ACCOUNT_META[account.isActive ? "active" : "suspended"]} />
        <ParentFormDialog key={account.id}
          trigger={<Button variant="outline" className="min-h-11">{account.isActive ? "Suspend account" : "Reactivate account"}</Button>}
          title={account.isActive ? "Suspend parent account" : "Reactivate parent account"}
          description={account.isActive ? `Block ${account.email} from signing in and end their current sessions. This affects all their linked swimmers at every site.`
            : `Allow ${account.email} to sign in again. This does not restore any revoked swimmer access.`}
          submitLabel={account.isActive ? "Suspend account" : "Reactivate account"}
          successMessage={account.isActive ? "Parent account suspended." : "Parent account reactivated."}
          submit={data => saveParentAdmin(`accounts/${encodeURIComponent(account.id)}`, "PATCH", { isActive: !account.isActive, reason: String(data.get("reason") ?? "") })}
          onSuccess={() => setResult({ email: account.email, account: { ...account, isActive: !account.isActive } })}>
          <div className="pc-note text-sm"><p className="min-w-0 break-all font-semibold">{account.email}</p></div><ParentReason />
        </ParentFormDialog>
          </div>
        </div>
        <p className="pc-row-hint">{account.isActive ? "Suspending blocks sign-in and ends all current sessions, at every site and for every linked swimmer." : "Reactivating allows sign-in again. Previously revoked swimmer access stays revoked; the parent must sign in again."}</p>
      </section> : null}
    </div>
    {!result && !pending && !error ? <p className="pc-row-hint">Parent accounts are shared across your sites. To approve or revoke access to one swimmer, open that swimmer’s Parent access tab.</p> : null}
  </div>;
}
