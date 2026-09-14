"use client";

import { useState } from "react";
import { Copy, Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";

export function ArticleTools() {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      // A shared guide never includes somebody’s search text or working filters.
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setMessage("Link copied. Staff must sign in to read it.");
    } catch {
      setMessage("Could not copy the link. Copy the address from your browser instead.");
    }
  }
  return <div className="space-y-2 print:hidden"><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={copy}><Copy aria-hidden="true" />Copy link</Button><Button variant="ghost" className="min-h-11" onClick={() => window.print()}><Printer aria-hidden="true" />Print guide</Button></div><p role="status" className="text-xs text-ui-muted-foreground">{message}</p></div>;
}
