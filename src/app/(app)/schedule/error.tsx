"use client";

import { Button } from "@/components/shadcn/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";

export default function ScheduleError({ reset }: { reset: () => void }) {
  return <div className="space-y-6"><h1 className="text-2xl font-semibold tracking-tight">Schedule</h1><Alert variant="destructive"><AlertTitle>Schedule could not be loaded</AlertTitle><AlertDescription>Try again to load the selected day’s classes and assessments.</AlertDescription></Alert><Button className="min-h-11" onClick={reset}>Try again</Button></div>;
}
