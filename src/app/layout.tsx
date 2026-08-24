import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Swimly", template: "%s · Swimly" },
  // Placeholder until the product has its own sentence. See DESIGN.md.
  description: "A calm, document-like workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Pinned to light: the app ships one mode, on purpose. */}
        <Toaster theme="light" position="bottom-right" />
      </body>
    </html>
  );
}
