import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { AuthFrame } from "@/components/auth-frame";

export const metadata: Metadata = { title: "Page not found" };

/** Any address that does not exist, and any record a page turns into a 404:
 *  the fin on the canvas, as for sign-in, with one way back. It says nothing
 *  about whether the record exists, so a 404 never confirms one. */
export default function NotFound() {
  return (
    <AuthFrame>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-sm text-ui-muted-foreground">This page does not exist, or you do not have access to it. Check the address, or start again from home.</p>
        </div>
        <Button asChild className="w-full"><Link href="/">Go to home</Link></Button>
      </div>
    </AuthFrame>
  );
}
