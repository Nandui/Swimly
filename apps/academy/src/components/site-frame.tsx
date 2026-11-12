"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { AccountLink } from "@/components/account-link";
import logo from "../../public/brand/leisureworld-white-no-tagline.png";

/** The LeisureWorld logo and the site's name, as on the parents app's header. */
export function Brand() {
  return (
    <Link href="/" aria-label="LeisureWorld Academy home" className="site-brand">
      <Image src={logo} alt="" priority className="site-logo" />
      <span className="site-brand-name">Academy</span>
    </Link>
  );
}

/** Courses, then "My bookings" once signed in on this browser, otherwise "Sign in". */
export function SiteNav() {
  const pathname = usePathname();
  const onCourses = pathname === "/" || pathname.startsWith("/courses");
  return (
    <nav aria-label="Site" className="site-nav">
      <Button asChild variant="ghost" className="site-nav-courses"><Link href="/" aria-current={onCourses ? "page" : undefined}>Courses</Link></Button>
      <AccountLink />
    </nav>
  );
}

type Theme = "light" | "dark" | "system";
const readTheme = (): Theme => {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
};
function subscribeTheme(fn: () => void) {
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Device, light, dark: the same appearance switch as the parents app, kept in a cookie. */
export function ThemeButton() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const Icon = theme === "system" ? Laptop : theme === "light" ? Sun : Moon;
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={`Use ${next} appearance`} title={`Use ${next} appearance`}
      onClick={() => {
        if (next === "system") delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = next;
        document.cookie = `academy-theme=${next};Path=/;Max-Age=31536000;SameSite=Lax`;
      }}>
      <Icon aria-hidden="true" />
    </Button>
  );
}
