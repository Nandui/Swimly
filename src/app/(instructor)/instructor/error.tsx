"use client";

import { Button } from "@/components/shadcn/button";
import { Notice } from "@/components/ui-kit/notice";

export default function Error({ reset }: { reset: () => void }) {
  return <div className="flex flex-col items-start gap-4 py-6">
    <h1 className="text-2xl font-semibold">Could not load this class</h1>
    <Notice tone="error" title="Check your connection and try again." actions={<Button className="min-h-11" onClick={reset}>Try again</Button>} />
  </div>;
}
