"use client";

import { Button } from "@/components/shadcn/button";

export default function Error({ reset }: { reset: () => void }) {
  return <div className="flex flex-col items-start gap-4 py-6" role="alert">
    <h1 className="text-2xl font-semibold">Could not load this class</h1>
    <p className="text-ui-muted-foreground">Check your connection and try again.</p>
    <Button onClick={reset}>Try again</Button>
  </div>;
}
