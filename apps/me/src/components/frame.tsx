"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BookOpen, CalendarDays, GraduationCap, House, LogOut, Menu } from "lucide-react";
import { api, session } from "@/lib/api";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/reading", label: "Reading", icon: BookOpen },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/more", label: "More", icon: Menu },
];
const MORE = ["/more", "/qualifications", "/hr", "/details", "/reminders"];

/** Every signed-in page: the brand, sign out, the page, and the tab bar. */
export function Frame({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const active = (href: string) => href === "/" ? pathname === "/" : href === "/more" ? MORE.some((p) => pathname.startsWith(p)) : pathname.startsWith(href);
  async function signOut() {
    setLeaving(true);
    try { await api("auth/logout", { method: "POST" }); } catch { /* the token is dropped anyway */ }
    session.clear();
    router.replace("/sign-in");
  }
  return (
    <div className="frame">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Turnfin Me home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" /> Turnfin <span>Me</span>
        </Link>
        <button type="button" className="button ghost" onClick={signOut} disabled={leaving}><LogOut aria-hidden="true" />Sign out</button>
      </header>
      <nav className="tabs" aria-label="Turnfin Me">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><Icon aria-hidden="true" />{label}</Link>
        ))}
      </nav>
      <main className="page" id="main" aria-label={title}>{children}</main>
    </div>
  );
}
