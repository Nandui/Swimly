"use client";

import { Button } from "@/components/shadcn/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";

export default function AnalyticsError({ reset }: { reset: () => void }) {
  return <div className="space-y-6"><h1 className="text-2xl font-semibold tracking-tight">Analytics</h1><Alert variant="destructive"><AlertTitle>Analytics could not be loaded</AlertTitle><AlertDescription>The figures are unavailable. Try again to load the latest totals.</AlertDescription></Alert><Button className="min-h-11" onClick={reset}>Try again</Button></div>;
}
