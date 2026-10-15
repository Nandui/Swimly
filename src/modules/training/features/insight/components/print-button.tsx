"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";

/** The browser's print dialog, where "Save as PDF" makes the file to keep or send. */
export function PrintButton() {
  return <Button variant="outline" className="min-h-11 print:hidden" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</Button>;
}
