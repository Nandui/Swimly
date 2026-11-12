"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, LogIn } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { useSession } from "@/lib/use-session";

/** "My bookings" once signed in on this browser, otherwise "Sign in", in the navy header. */
export function AccountLink() {
  const pathname = usePathname();
  const who = useSession();
  if (who === undefined) return <span className="site-nav-placeholder" aria-hidden="true" />;
  const href = who ? "/bookings" : "/sign-in";
  return (
    <Button asChild variant="ghost">
      <Link href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
        {who ? <><CircleUserRound aria-hidden="true" />My bookings</> : <><LogIn aria-hidden="true" />Sign in</>}
      </Link>
    </Button>
  );
}
