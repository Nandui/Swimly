"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, GraduationCap, House, LayoutGrid, LogOut } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { TextSizeEffect } from "@/components/learner";
import { OfflineBar, useOffline } from "@/components/offline";
import { api, session } from "@/lib/api";
import { clearAll } from "@/lib/offline";

/** The tab bar holds four destinations (DESIGN.md, Phone): Home, Training, Shifts and More.
 *  Reading is in More, and what is due shows on Home. */
const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/more", label: "More", icon: LayoutGrid },
];
const MORE = ["/more", "/reading", "/qualifications", "/hr", "/details", "/reminders", "/display", "/offline"];
/** How far the page scrolls before the large title gives way to the glass bar, and before
 *  scrolling down minimises the tab bar. */
const TITLE_AT = 56;
const MINIMISE_AT = 160;

/** The fin on its tile (Turnfin's `.tf-brand`) and the name beside it, on the sign-in page. */
export function Brand({ href }: { href?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  const fin = <img src="/icon-192.png" alt="" width={72} height={72} />;
  return (
    <div className="brand">
      {href ? <Link href={href} className="tf-brand" aria-label="Turnfin Me home">{fin}</Link> : <span className="tf-brand" aria-hidden="true">{fin}</span>}
      <span className="brand-name">Turnfin Me</span>
    </div>
  );
}

/** Signing out, at the foot of More. Changes not sent yet would be lost, so it says so first. */
export function SignOut() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { waiting } = useOffline();
  async function signOut(sure = false) {
    if (waiting && !sure) { setConfirming(true); return; }
    setLeaving(true);
    try { await api("auth/logout", { method: "POST" }); } catch { /* the token is dropped anyway */ }
    session.clear();
    await clearAll();
    router.replace("/sign-in");
  }
  return confirming ? (
    <div className="offline-failed" role="alert">
      <p><strong>{waiting === 1 ? "1 change hasn’t" : `${waiting} changes haven’t`} reached Turnfin yet.</strong> Signing out now deletes {waiting === 1 ? "it" : "them"} from this phone.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => void signOut(true)}>Sign out anyway</Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Stay signed in</Button>
      </div>
    </div>
  ) : (
    <Button type="button" variant="outline" className="self-start" onClick={() => void signOut()} disabled={leaving}>
      <LogOut aria-hidden="true" />{leaving ? "Signing out…" : "Sign out"}
    </Button>
  );
}

/** Every signed-in page in the phone frame (DESIGN.md, Phone): the page with its large title, a
 *  glass bar with the title inline once the large one scrolls away, and the glass tab bar, which
 *  minimises to the current tab while scrolling down and comes back on the way up. `title` is the
 *  page's name; it also names the browser tab. */
export function Frame({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const [titled, setTitled] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setTitled(y > TITLE_AT);
      setMinimised(y > MINIMISE_AT && y > last.current);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const active = (href: string) => href === "/" ? pathname === "/" : href === "/more" ? MORE.some((p) => pathname.startsWith(p)) : pathname.startsWith(href);
  return (
    <div className="frame">
      <title>{`${title} · Turnfin Me`}</title>
      <TextSizeEffect />
      <div className="me-nav glass" data-shown={titled ? "" : undefined} aria-hidden="true">
        <span className="me-nav-title">{title}</span>
      </div>
      <OfflineBar />
      <main className="page" id="main" aria-label={title}>{children}</main>
      <nav className="tf-bottom glass" aria-label="Turnfin Me" data-minimised={minimised ? "" : undefined}>
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="tf-bottom-item" aria-current={active(href) ? "page" : undefined}>
            <span className="tf-bottom-icon"><Icon aria-hidden="true" /></span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
