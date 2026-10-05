"use client";

import { AuthFrame } from "@/components/auth-frame";
import { PageError } from "@/components/ui-kit/page-state";

/** Errors from Home and from every module layout (a module's own error.tsx
 *  never wraps its layout): the same state on the sign-in canvas. */
export default function RootError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <AuthFrame>
      <PageError retry={retry} />
    </AuthFrame>
  );
}
