"use client";

import { PageError } from "@/components/ui-kit/page-state";

/** The shared error state, with the one warning a form needs: a save may have landed. */
export default function RiskErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageError retry={retry} hint="If you were saving a change, open the assessment and check its history before making it again." />;
}
