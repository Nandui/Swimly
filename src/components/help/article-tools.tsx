"use client";

import { Copy, Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { toast } from "@/components/ui/toast";

export function ArticleTools() {
  async function copy() {
    try {
      // A shared guide never includes somebody’s search text or working filters.
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      toast.success("Link copied. Staff must sign in to read it.");
    } catch {
      toast.error("Could not copy the link. Copy the address from your browser instead.");
    }
  }
  return <div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" onClick={copy}><Copy aria-hidden="true" />Copy link</Button><Button variant="outline" onClick={() => window.print()}><Printer aria-hidden="true" />Print guide</Button></div>;
}
