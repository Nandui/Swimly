import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/shadcn/button";
import { ThemeFlip } from "@/components/theme-toggle";
import { helpHref } from "@/lib/help/search";
import type { HelpScope } from "@/lib/help/types";

export function HelpFrame({ scope, home, children }: { scope: HelpScope; home: string; children: ReactNode }) {
  return <div className="shadcn-workspace min-h-dvh bg-ui-background text-sm text-ui-foreground">
    <a href="#help-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to help content</a>
    <header className="border-b border-ui-border print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 lg:px-6">
        <Link href={helpHref(scope)} className="flex min-h-11 items-center gap-2 font-semibold"><AppLogo className="size-8" />Help centre</Link>
        <div className="flex items-center gap-2">
          <div className="[&>button]:size-11"><ThemeFlip /></div>
          <Button asChild variant="outline" className="min-h-11"><Link href={home}><ArrowLeft aria-hidden="true" /><span>{scope === "instructor" ? "Back to classes" : "Back to app"}</span></Link></Button>
        </div>
      </div>
    </header>
    <main id="help-main" tabIndex={-1} className="mx-auto min-h-0 max-w-6xl px-4 py-6 outline-none lg:px-6 lg:py-8">{children}</main>
    <footer className="border-t border-ui-border print:hidden">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-6 lg:px-6">
        <LifeBuoy aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ui-muted-foreground" />
        <div className="space-y-1"><p className="font-medium">Still stuck? Ask your manager.</p><p className="max-w-2xl leading-relaxed text-ui-muted-foreground">Tell them which page you were using, what you tried to do and the exact error message. They can check your access and help with the next step.</p></div>
      </div>
    </footer>
  </div>;
}
