import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import Image from "next/image";
import { ThemeFlip } from "@/components/theme-toggle";
import { helpHref } from "@/lib/help/search";
import type { HelpScope } from "@/lib/help/types";

/** Help in the v2 frame (DESIGN.md, Poolside Clear v2): the fin, a tools bar with appearance and
 *  the way back, and the guides on the cool canvas in white panels. */
export function HelpFrame({ scope, home, children }: { scope: HelpScope; home: string; children: ReactNode }) {
  return <div className="shadcn-workspace min-h-dvh bg-ui-workspace text-sm text-ui-foreground">
    <a href="#help-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to help content</a>
    <header className="tf-top mx-auto max-w-6xl px-4 pt-4 lg:px-6 print:hidden">
      <Link href={helpHref(scope)} className="tf-brand" aria-label="Help centre home"><Image src="/brand/turnfin.png" alt="" width={72} height={72} priority /></Link>
      <span className="text-lg font-semibold">Help centre</span>
      <div className="tf-bar tf-tools" role="group" aria-label="Appearance and the way back">
        <ThemeFlip />
        <Link href={home} className="tf-bar-item"><ArrowLeft aria-hidden="true" />{scope === "instructor" ? "Back to classes" : "Back to app"}</Link>
      </div>
    </header>
    <main id="help-main" tabIndex={-1} className="tf-main tf-content mx-auto min-h-0 max-w-6xl px-4 py-6 outline-none lg:px-6">{children}</main>
    <footer className="mx-auto max-w-6xl px-4 pb-6 lg:px-6 print:hidden">
      <div className="pc-panel flex-row items-start gap-3">
        <LifeBuoy aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-muted-foreground" />
        <div className="space-y-1"><p className="font-medium">Still stuck? Ask your manager.</p><p className="max-w-2xl leading-relaxed text-ui-muted-foreground">Tell them which page you were using, what you tried to do and the exact error message. They can check your access and help with the next step.</p></div>
      </div>
    </footer>
  </div>;
}
