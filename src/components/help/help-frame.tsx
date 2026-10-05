import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import { helpHref } from "@/lib/help/search";
import type { HelpScope } from "@/lib/help/types";

/** Help in the v2 frame (DESIGN.md, Poolside Clear v2): the fin, "Help centre" and the way back
 *  (no rail: Help opens in its own tab), then the guides on the canvas in white panels.
 *  Appearance follows the setting from the account menu. */
export function HelpFrame({ scope, home, children }: { scope: HelpScope; home: string; children: ReactNode }) {
  const back = scope === "instructor" ? "Back to classes" : "Back to app";
  return <div className="tf-shell tf-help">
    <a className="skip-link" href="#help-main">Skip to content</a>
    <div className="tf-frame">
      <header className="tf-top">
        <Link href={helpHref(scope)} className="tf-brand" aria-label="Help centre home"><Image src="/brand/turnfin.png" alt="" width={72} height={72} priority /></Link>
        <span className="text-lg font-semibold">Help centre</span>
        <div className="tf-bar tf-tools" role="group" aria-label="The way back">
          <Link href={home} className="tf-bar-item"><ChevronLeft aria-hidden="true" /><span className="max-md:sr-only">{back}</span></Link>
        </div>
      </header>
      <main id="help-main" tabIndex={-1} className="tf-main"><div className="tf-content">{children}</div></main>
      <footer className="print:hidden"><p className="text-center text-xs text-ui-muted-foreground">Still stuck? Ask your manager.</p></footer>
    </div>
  </div>;
}
