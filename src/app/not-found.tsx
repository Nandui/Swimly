import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth-frame";
import { RootNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** Any address that does not exist, any record a page turns into a 404 and
 *  any module whose layout refuses the role: the fin on the canvas, as for
 *  sign-in, with one way back. It says nothing about whether the page exists,
 *  so a 404 never confirms one (src/lib/page-guards.ts). */
export default function NotFound() {
  return (
    <AuthFrame>
      <RootNotFound />
    </AuthFrame>
  );
}
