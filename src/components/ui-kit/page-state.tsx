"use client";

import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";

/** The page states every module shares (DESIGN.md, "States"). A module's
 *  `not-found.tsx` and `error.tsx` render these inside its frame; the root
 *  ones put the same content on the sign-in canvas (AuthFrame). */

const NOT_FOUND_TITLE = "This page isn’t available";
/** One answer for "missing" and "not in your role": a refused page declines
 *  to exist (src/lib/page-guards.ts), so the copy never confirms either. */
const NOT_FOUND_HINT = "It may have moved, or your role doesn’t include it. Ask your manager if you need it.";

/** A page or record that does not exist, or that the role does not open. */
export function PageNotFound({
  title = NOT_FOUND_TITLE,
  hint = NOT_FOUND_HINT,
  href = "/",
  actionLabel = "Go to Home",
}: {
  title?: string;
  hint?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title="Page not found" />
      <div className="pc-panel">
        <EmptyState
          as="h2"
          icon="searchX"
          title={title}
          hint={hint}
          action={<Button asChild><Link href={href}>{actionLabel}</Link></Button>}
        />
      </div>
    </div>
  );
}

/** The root 404's card on the sign-in canvas (AuthFrame supplies the card,
 *  so there is no panel here): the same state, its title the page's H1. */
export function RootNotFound() {
  return (
    <EmptyState
      as="h1"
      icon="searchX"
      title="Page not found"
      hint={NOT_FOUND_HINT}
      action={<Button asChild className="w-full"><Link href="/">Go to Home</Link></Button>}
    />
  );
}

/** A page that failed to load. `retry` is the error boundary's own: it
 *  re-fetches the segment (Next 16), where `reset` only re-renders it. */
export function PageError({
  retry,
  title = "Something went wrong",
  hint = "Check your connection and try again.",
}: {
  retry: () => void;
  title?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader title={title} />
      <Notice
        tone="error"
        title="Could not load this page."
        description={hint}
        actions={<Button onClick={() => retry()}>Try again</Button>}
      />
    </div>
  );
}
