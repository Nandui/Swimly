"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";

/** The shared refresh control: outline LoadingButton "Refresh" with the refresh icon. */
export function AnalyticsRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <LoadingButton variant="outline" pending={pending} pendingLabel="Refreshing…" onClick={() => startTransition(() => router.refresh())}><RefreshCw aria-hidden="true" />Refresh</LoadingButton>;
}
