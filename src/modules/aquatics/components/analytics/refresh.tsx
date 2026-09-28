"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/shadcn/button";

export function AnalyticsRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="flex min-w-0 flex-wrap items-center gap-2" aria-busy={pending}>
    <Button variant="outline" size="icon" className="size-11" aria-label="Refresh analytics" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
    </Button>
    <span className="sr-only" role="status">{pending ? "Updating analytics" : "Analytics up to date"}</span>
  </div>;
}
