"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ThemeFlip } from "@/components/theme-toggle";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { PORTAL_BRAND } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function PortalFrame({ children, reception = false, userName, moduleName }: {
  children: ReactNode;
  reception?: boolean;
  userName: string;
  moduleName?: string;
}) {
  const [signingOut, startSignOut] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function leave() {
    setError(null);
    startSignOut(async () => {
      try { await signOut({ redirectTo: "/sign-in" }); }
      catch { setError("Could not sign out. Please try again."); }
    });
  }
  const width = reception ? "max-w-6xl" : "max-w-5xl";
  return <div className={cn("flex min-h-svh flex-col bg-ui-workspace text-ui-foreground", reception && "reception-portal")}>
    <a href="#portal-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to content</a>
    <header className="border-b border-ui-border bg-ui-background px-4 lg:px-6">
      <div className={cn("mx-auto flex min-h-20 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3", width)}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative size-12 shrink-0 overflow-hidden" aria-hidden="true">
            <Image src="/brand/turnfin.png" width={1254} height={1254} sizes="88px" alt="" loading="eager" className="absolute -left-5 -top-5 size-22 max-w-none" />
          </span>
          <div><p className="text-xl font-semibold">{PORTAL_BRAND}</p><p className="text-xs text-ui-muted-foreground">{moduleName ?? (reception ? "Reception Portal" : "Staff portal")}</p></div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {reception && <Button asChild variant="ghost" className="hidden min-h-11 max-w-48 sm:inline-flex"><Link href="/account"><span className="truncate">{userName}</span></Link></Button>}
          <div className="[&_button]:size-11"><ThemeFlip /></div>
          {reception ? <Button variant="ghost" className="min-h-11 max-sm:w-11 max-sm:px-0" aria-label={signingOut ? "Signing out…" : "Sign out"} aria-busy={signingOut} disabled={signingOut} onClick={leave}>{signingOut ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}<span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span></Button>
            : <LoadingButton variant="ghost" className="min-h-11" onClick={leave} pending={signingOut} pendingLabel="Signing out…"><LogOut aria-hidden="true" />Sign out</LoadingButton>}
        </div>
      </div>
    </header>
    <main id="portal-main" tabIndex={-1} className={cn("w-full flex-1 px-4 lg:px-6", reception ? "py-6 lg:py-8" : "py-8 lg:py-12")}>
      <div className={cn("mx-auto space-y-6", width)}>{error && <Notice tone="error" title={error} />}{children}</div>
    </main>
  </div>;
}
