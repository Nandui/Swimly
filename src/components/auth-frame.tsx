import Image from "next/image";
import { Card } from "@/components/shadcn/card";

/** The frame for every page outside the app: sign in, switch user, confirm it's you.
 *  The fin and "Turnfin" above one white panel on the cool canvas (DESIGN.md, Poolside
 *  Clear v2), with an optional note under the panel. No decoration. */
export function AuthFrame({ note, children }: { note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh min-w-0 flex-col bg-ui-workspace">
      <main className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-8">
        <div className="flex w-full max-w-sm min-w-0 flex-col gap-6">
          <span className="flex items-center gap-3">
            {/* The artwork has wide margins, so it is enlarged inside a clipping box. */}
            <span className="relative size-14 shrink-0 overflow-hidden" aria-hidden="true">
              <Image src="/brand/turnfin.png" alt="" width={176} height={176} priority className="absolute left-1/2 top-1/2 size-[170%] max-w-none -translate-x-1/2 -translate-y-1/2" />
            </span>
            <span className="text-2xl font-semibold text-ui-foreground">Turnfin</span>
          </span>
          <Card className="gap-5 p-6">{children}</Card>
          {note ? <p className="text-center text-xs text-ui-muted-foreground">{note}</p> : null}
        </div>
      </main>
      <p className="p-4 text-center text-xs text-ui-muted-foreground">Turnfin Work · for work computers at LeisureWorld</p>
    </div>
  );
}
