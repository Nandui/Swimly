"use client";

import { Button } from "@/components/shadcn/button";

export default function RefundErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <div className="space-y-4">
    <h1 className="text-2xl font-semibold">Refunds could not be loaded</h1>
    <p className="text-sm text-ui-muted-foreground">Please try again. If you were saving a request, check its history before making another change.</p>
    <Button className="min-h-11" onClick={retry}>Try again</Button>
  </div>;
}
