"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { ArrowRight, LogOut } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { ThemeFlip } from "@/components/theme-toggle";
import { PORTAL_BRAND, STAFF_MODULES, moduleStatusMeta } from "@/lib/modules";

/** Staff choose a module before entering its workspace. Keep this small,
 *  task-focused and independent of site selection or teaching permissions. */
export function StaffPortal({ userName, docsAllowed = false, aquaticsAllowed = true }: { userName: string; docsAllowed?: boolean; aquaticsAllowed?: boolean }) {
  const [signingOut, startSignOut] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function leave() {
    setError(null);
    startSignOut(async () => {
      try {
        await signOut({ redirectTo: "/sign-in" });
      } catch {
        setError("Could not sign out. Please try again.");
      }
    });
  }

  return (
    <div className="flex min-h-svh flex-col bg-ui-workspace text-ui-foreground">
      <a href="#portal-main" className="sr-only fixed left-4 top-4 z-50 rounded-ui-md bg-ui-primary p-3 text-ui-primary-foreground focus:not-sr-only">Skip to content</a>
      <header className="border-b border-ui-border bg-ui-background px-4 lg:px-6">
        <div className="mx-auto flex min-h-20 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {/* Frame the supplied transparent canvas without changing the logo artwork. */}
            <span className="relative size-12 shrink-0 overflow-hidden" aria-hidden="true">
              <Image src="/brand/turnfin.png" width={1254} height={1254} sizes="88px" alt="" loading="eager" className="absolute -left-5 -top-5 size-22 max-w-none" />
            </span>
            <div>
              <p className="text-xl font-semibold">{PORTAL_BRAND}</p>
              <p className="text-xs text-ui-muted-foreground">Staff portal</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="[&_button]:size-11"><ThemeFlip /></div>
            <LoadingButton variant="ghost" className="min-h-11" onClick={leave} pending={signingOut} pendingLabel="Signing out…">
              <LogOut aria-hidden="true" />Sign out
            </LoadingButton>
          </div>
        </div>
      </header>

      <main id="portal-main" tabIndex={-1} className="w-full flex-1 px-4 py-8 lg:px-6 lg:py-12">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Choose your workspace</h1>
            <p className="text-sm text-ui-muted-foreground">Your LeisureWorld apps, in one place.</p>
          </div>
          {error ? <Notice tone="error" title={error} /> : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Staff modules">
            {STAFF_MODULES.filter(module => (module.id !== "docs" || docsAllowed) && (module.id !== "swimly" || aquaticsAllowed)).map(module => {
              const status = moduleStatusMeta[module.status];
              const Icon = module.icon;
              return (
                <Card key={module.id} className="gap-6 p-6 shadow-none">
                  <div className="flex min-h-12 items-center justify-between gap-3">
                    <Icon className="size-8 text-ui-muted-foreground" aria-hidden="true" />
                    <Tag color={status.color}>{status.label}</Tag>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h2 className="text-xl font-semibold">{module.name}</h2>
                    <p className="text-sm leading-relaxed text-ui-muted-foreground">{module.description}</p>
                  </div>
                  {module.status === "available" ? (
                    <Button asChild className="min-h-11 w-full justify-between">
                      <Link href={module.href} prefetch={false}>Open {module.name}<ArrowRight aria-hidden="true" /></Link>
                    </Button>
                  ) : null}
                </Card>
              );
            })}
          </div>
          <p className="break-words text-sm text-ui-muted-foreground">Signed in as <span className="font-medium text-ui-foreground">{userName}</span></p>
        </div>
      </main>
    </div>
  );
}
