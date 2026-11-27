import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/access/actions";
import type { Account } from "@/access/session";
import { db } from "@/data/db";

/** The pages built so far, in the order of the top bar. A page is added here when it exists:
 *  the bar never offers one that does not. */
const PAGES = [{ href: "/", label: "Home" }] as const;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");

/** Where this person works, in a few words, for under their name. */
async function whereLine(account: Account): Promise<string> {
  const ids = account.access.siteIds;
  if (ids.length === 0) return "Every site";
  if (ids.length > 1) return `${ids.length} sites`;
  const site = await db.club.findUnique({ where: { id: ids[0]! }, select: { name: true } });
  return site?.name ?? "1 site";
}

/** Courses' frame: the blue ground with the fin, a top bar on it, then whatever the page puts
 *  on the ground (its header) and on the sheet (its work). One frame for every signed-in page. */
export async function Frame({ account, current, header, children }: { account: Account; current: string; header: ReactNode; children: ReactNode }) {
  const where = await whereLine(account);
  return (
    <div className="tc-ground">
      <div className="tc-fin" aria-hidden="true" />
      <header className="tc-bar">
        <Link className="tc-brand" href="/">
          <span className="tc-logo"><Image src="/brand/turnfin.png" alt="" width={46} height={46} priority /></span>
          Courses
        </Link>
        <nav className="tc-nav" aria-label="Courses">
          {PAGES.map((page) => (
            <Link key={page.href} href={page.href} aria-current={page.href === current ? "page" : undefined}>{page.label}</Link>
          ))}
        </nav>
        <div className="tc-me">
          <span className="tc-me-text">
            <span className="tc-me-name">{account.name}</span>
            <span className="tc-me-where">{where}</span>
          </span>
          <span className="tc-avatar" aria-hidden="true">{initials(account.name)}</span>
          <form action={signOut}><button className="tc-ground-button" type="submit">Sign out</button></form>
        </div>
      </header>
      <section className="tc-head">{header}</section>
      <main className="tc-sheet">{children}</main>
    </div>
  );
}

/** The search on the ground: the first thing on Home, and the title of its results. */
export function Find({ query = "", autoFocus = false }: { query?: string; autoFocus?: boolean }) {
  return (
    <form className="tc-find" action="/find" role="search">
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.6-3.6" />
      </svg>
      <input type="search" name="q" defaultValue={query} autoFocus={autoFocus} required maxLength={100}
        aria-label="Find a swimmer, parent or member number" placeholder="Find a swimmer, parent or member number" />
      <button type="submit">Find</button>
    </form>
  );
}
