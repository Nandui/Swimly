import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth-frame";
import { RootNotFound } from "@/components/ui-kit/page-state";

export const metadata: Metadata = { title: "Page not found" };

/** Help has no frame layout (HelpFrame is drawn by its page), so a missing
 *  guide shows the root not-found card on the sign-in canvas. */
export default function HelpNotFound() {
  return (
    <AuthFrame>
      <RootNotFound />
    </AuthFrame>
  );
}
