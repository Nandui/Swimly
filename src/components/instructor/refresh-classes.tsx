"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";

/** Only mounted on the list: keep Now/Next and cover current without
 * refreshing attendance or competency forms that hold unsaved work. */
export function RefreshClasses() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return (
    <LoadingButton
      variant="outline"
      pending={pending}
      pendingLabel="Refreshing…"
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw
        aria-hidden="true"
      />
      Refresh classes
    </LoadingButton>
  );
}
