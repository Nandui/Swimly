"use client";

import { PageError } from "@/components/ui-kit/page-state";

/** The shared error state, with the one warning a report needs: a send may have landed. */
export default function MaintenanceErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageError retry={retry} hint="If you were sending a report, check Yours before sending it again." />;
}
