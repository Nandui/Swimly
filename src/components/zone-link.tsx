import Link from "next/link";
import type { ComponentProps } from "react";
import { crossesZone } from "@/lib/zones";

type Props = ComponentProps<typeof Link> & { href: string };

/** Link props that mean nothing on a plain anchor. */
const LINK_ONLY = new Set(["prefetch", "replace", "scroll", "shallow", "locale", "legacyBehavior", "passHref", "onNavigate"]);

/** A link that works across Turnfin's apps. Inside the same app it is a
 *  normal Next.js Link (prefetch, soft navigation); to a page served by the
 *  other app (Work ↔ Activities) it is a plain anchor, as multi-zones
 *  require, so the browser loads that app's page. */
export function ZoneLink(props: Props) {
  if (!crossesZone(props.href)) return <Link {...props} />;
  const anchor = Object.fromEntries(Object.entries(props).filter(([key]) => !LINK_ONLY.has(key))) as ComponentProps<"a">;
  return <a {...anchor} />;
}
