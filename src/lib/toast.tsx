"use client";

import { toast as sonner } from "sonner";
import { Toaster } from "@/components/shadcn/sonner";
import { usePathname } from "next/navigation";

/** Preserve the app's imperative API and keep errors until dismissed. */
export const toast = {
  success(message: string) { sonner.success(message); },
  error(message: string) { sonner.error(message, { duration: Infinity }); },
};

export function ToastBridge() {
  const pathname = usePathname();
  const onDeck = pathname === "/instructor" || pathname.startsWith("/instructor/");
  // The deck's save/continue controls occupy the bottom edge. Never cover
  // them with the notification confirming the save they just made.
  return <Toaster position={onDeck ? "top-center" : "bottom-right"} offset={onDeck ? 80 : undefined} mobileOffset={onDeck ? 144 : undefined} closeButton />;
}
