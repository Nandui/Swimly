"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Search, Undo2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ConfirmAction } from "@/components/confirm-action";
import { redeemVoucher, unredeemVoucher, voidVoucher } from "@/modules/vouchers/features/redeem/server/actions";
import { toast } from "@/components/ui/toast";

/** The code field: the page's one job, so it takes the focus on arrival. The
 *  page keys it by the code checked, so it is ready again for the next voucher. */
export function CodeLookup({ typed }: { typed: string }) {
  const router = useRouter();
  const [value, setValue] = useState(typed);
  const [pending, start] = useTransition();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); field.current?.select(); }, []);
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => {
      e.preventDefault();
      const code = value.trim();
      start(() => router.push(code ? `/vouchers?${new URLSearchParams({ code })}` : "/vouchers"));
    }}>
      <Label htmlFor="voucher-code">Voucher code</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input ref={field} id="voucher-code" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} required maxLength={20}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search" placeholder="7K3M-9QXD" aria-describedby="voucher-code-hint"
          className="min-h-11 min-w-0 flex-1 basis-56 text-base font-semibold tracking-widest tabular-nums sm:max-w-xs" />
        <Button type="submit" className="min-h-11" disabled={pending || !value.trim()}><Search aria-hidden="true" />Check voucher</Button>
      </div>
      <p id="voucher-code-hint" className="text-xs text-ui-muted-foreground">Eight characters, printed on the voucher. Dashes and spaces do not matter.</p>
    </form>
  );
}

/** Mark the checked voucher as used, at the site this person is working at
 *  (they choose when the voucher is accepted at more than one of their sites). */
export function RedeemVoucher({ code, sites }: { code: string; sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const result = await redeemVoucher(code, siteId);
        if (!result.ok) { setError(result.error); router.refresh(); return; }
        toast.success("Voucher marked as used");
        router.refresh();
      });
    }}>
      <div className="flex flex-wrap items-end gap-3">
        {sites.length > 1 ? (
          <div className="min-w-48 space-y-2">
            <Label htmlFor="voucher-site">Used at</Label>
            <NativeSelect id="voucher-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        ) : null}
        <Button type="submit" className="min-h-11" disabled={pending || !siteId}><Check aria-hidden="true" />{sites.length === 1 ? `Mark as used at ${sites[0].name}` : "Mark as used"}</Button>
      </div>
      {error ? <p className="text-sm text-ui-destructive" role="alert">{error}</p> : null}
    </form>
  );
}

/** Put right a voucher marked as used by mistake. */
export function UndoRedeem({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="outline" className="min-h-11"><Undo2 aria-hidden="true" />Mark as not used</Button>}
      title={`Mark ${code} as not used?`}
      description="For a voucher marked as used by mistake. It can be used again, and the change is recorded."
      confirmLabel="Mark as not used"
      successMessage="Voucher can be used again"
      run={async () => { const r = await unredeemVoucher(id); if (r.ok) router.refresh(); return r; }}
    />
  );
}

/** Cancel one unused voucher, for example one reported lost. */
export function VoidVoucher({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" className="min-h-11 text-ui-destructive"><Ban aria-hidden="true" />Cancel this voucher</Button>}
      title={`Cancel voucher ${code}?`}
      description="For a voucher that was lost or should not be used. It stops working and cannot be brought back."
      confirmLabel="Cancel voucher"
      successMessage="Voucher cancelled"
      destructive
      run={async () => { const r = await voidVoucher(id); if (r.ok) router.refresh(); return r; }}
    />
  );
}
