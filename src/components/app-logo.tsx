import Image from "next/image";
import { cn } from "@/lib/utils";

/** The adjacent wordmark or labelled link supplies the accessible name. */
export function AppLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/app-logo.png"
      width={64}
      height={64}
      alt=""
      aria-hidden="true"
      loading="eager"
      className={cn("size-10 shrink-0 object-contain", className)}
    />
  );
}
