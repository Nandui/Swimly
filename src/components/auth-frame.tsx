import Image from "next/image";
import { Card } from "@/components/shadcn/card";
import { cn } from "@/lib/utils";

/** The fin on its own tile, drawn with the shared `.tf-brand` box the frame and Help use.
 *  Decorative: the page's H1 or the wordmark beside it names the place. */
export function Fin({ className }: { className?: string }) {
  return (
    <span className={cn("tf-brand", className)} aria-hidden="true">
      <Image src="/brand/turnfin.png" alt="" width={72} height={72} priority />
    </span>
  );
}

/** The frame for every page outside the app: sign in, switch user, confirm it's you and
 *  the 404 (DESIGN.md, Poolside Clear v2; AUSignIn, AUConfirm, AUSwitch). One white panel
 *  on the outer canvas. `welcome` adds the blue brand panel beside it (sign-in only; hidden
 *  on phones, stacked above the form at 768); `fin` puts the fin at the top of the panel,
 *  at the start (confirm it's you) or centred over a centred state (404 and errors).
 *  The brand panel's headline is a paragraph, so the form's H1 stays the only one. */
export function AuthFrame({ welcome = false, fin, children }: { welcome?: boolean; fin?: "start" | "center"; children: React.ReactNode }) {
  return (
    <div className="min-h-svh min-w-0 bg-[var(--pc-outer)]">
      <main className="mx-auto flex min-h-svh max-w-[1100px] min-w-0 flex-wrap items-stretch justify-center gap-6 p-4 sm:p-6">
        {welcome ? (
          <div className="hidden min-w-0 flex-[1_1_420px] flex-col justify-between gap-6 rounded-ui-2xl bg-[var(--pc-primary)] p-12 text-[var(--pc-on-primary)] md:flex">
            <span className="flex items-center gap-3">
              <Fin className="bg-[var(--pc-surface)]" />
              <span className="text-2xl font-semibold">Turnfin</span>
            </span>
            <div className="flex flex-col gap-2">
              <p className="text-2xl font-semibold">People. Places. Progress.</p>
              <p className="max-w-[420px]">The swim school, the rota, training, documents and refunds for your pools, in one place.</p>
            </div>
            <p className="text-xs">Turnfin Work · for work computers</p>
          </div>
        ) : null}
        <div className="flex min-w-0 max-w-[460px] flex-[1_1_380px] flex-col justify-center">
          <Card className="min-w-0 gap-4 p-8 max-sm:p-6">
            {fin ? <Fin className={fin === "center" ? "self-center" : undefined} /> : null}
            {children}
          </Card>
        </div>
      </main>
    </div>
  );
}
