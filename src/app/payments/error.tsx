"use client";

import { PageError } from "@/components/ui-kit/page-state";

/** The shared error state, with the one warning an upload needs: it may have landed. */
export default function PaymentsErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageError retry={retry} hint="If you were uploading the failure sheet, check Failed payments before uploading it again." />;
}
