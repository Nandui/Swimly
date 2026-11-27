import type { Metadata } from "next";
import Link from "next/link";
import { requireGrant } from "@/access/session";
import { Find, Frame } from "@/frame/frame";
import { inTurnfin } from "@/frame/turnfin";
import { findSwimmers } from "@/home/data";

export const metadata: Metadata = { title: "Find a swimmer · Turnfin Courses" };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");

/** The desk's search: swimmers at the person's sites, by name, family contact or member number.
 *  A result names the swimmer and nothing more; their page is still Turnfin's for now. */
export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const account = await requireGrant("desk");
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) ?? "";
  const found = await findSwimmers(account, query);
  return (
    <Frame account={account} current="/find" header={
      <>
        <div className="tc-eyebrow"><Link href="/" style={{ color: "inherit" }}>Home</Link></div>
        <h1 className="tc-title">Find a swimmer</h1>
        <Find query={query} autoFocus={!query} />
      </>
    }>
      {!query ? (
        <p className="tc-note">Type a swimmer&apos;s name, a parent&apos;s name or a member number.</p>
      ) : found.length === 0 ? (
        <p className="tc-note">Nobody at your sites matches “{query}”. Check the spelling, or try the member number.</p>
      ) : (
        <>
          <h2 className="tc-section">{found.length === 25 ? "The first 25 matches" : found.length === 1 ? "1 match" : `${found.length} matches`}</h2>
          <ul className="tc-rows">
            {found.map((swimmer) => {
              const href = inTurnfin(`/students/${encodeURIComponent(swimmer.id)}`);
              const row = (
                <>
                  <span className="tc-initials" aria-hidden="true">{initials(swimmer.name)}</span>
                  <span className="tc-row-text">
                    <span className="tc-row-1">{swimmer.name}</span>
                    <span className="tc-row-2">{swimmer.memberNumber ? `Member ${swimmer.memberNumber} · ${swimmer.site}` : swimmer.site}</span>
                  </span>
                </>
              );
              return <li key={swimmer.id}>{href ? <a className="tc-row" href={href}>{row}</a> : <div className="tc-row">{row}</div>}</li>;
            })}
          </ul>
        </>
      )}
    </Frame>
  );
}
