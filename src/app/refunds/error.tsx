"use client";

import { PageError } from "@/components/ui-kit/page-state";

/** The shared error state, with the one warning money needs: a save may have landed. */
export default function RefundErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageError retry={retry} hint="If you were saving a request, check its history before making another change." />;
}
