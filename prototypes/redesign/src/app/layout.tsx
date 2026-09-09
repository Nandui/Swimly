import type { Metadata } from "next";
import "@fontsource/figtree/latin-400.css";
import "@fontsource/figtree/latin-500.css";
import "@fontsource/figtree/latin-600.css";
import "@fontsource/figtree/latin-700.css";
import "./globals.css";
import { PrototypeProvider } from "../components/provider";
import { Shell } from "../components/shell";
import { APP_NAME } from "../lib/fixtures";

export const metadata: Metadata = {
  title: `${APP_NAME} · Design preview`,
  description: "An interactive swim school workspace with fictional data.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IE">
      <body>
        <PrototypeProvider>
          <Shell>{children}</Shell>
        </PrototypeProvider>
      </body>
    </html>
  );
}
