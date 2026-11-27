import type { Metadata } from "next";
import Link from "next/link";
import { requireGrant } from "@/access/session";
import { Frame } from "@/frame/frame";
import { inTurnfin } from "@/frame/turnfin";
import { placeSwimmer } from "@/place/actions";
import { dayName, placedSummary, swimmerFor, type OpenClass, type Swimmer } from "@/place/data";
import { waitingFor } from "@/place/queue";
import { REFUSED } from "@/place/reasons";

export const metadata: Metadata = { title: "Place a swimmer · Turnfin Courses" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
const waited = (days: number) => (days === 0 ? "waiting since today" : days === 1 ? "waiting 1 day" : `waiting ${days} days`);
const freeLine = (c: OpenClass) => (c.free === null ? "No limit on places" : `${c.free} free of ${c.capacity}`);

function Arrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/** The class tiles, or, once one is picked, the picture of the change to confirm. Every
 *  enrolment is confirmed before it is saved (owner, 21 October 2026); here that happens in
 *  place, not in a dialog. */
function Classes({ swimmer, at, pick }: { swimmer: Swimmer; at: number; pick: OpenClass | undefined }) {
  if (pick) {
    return (
      <form className="tc-confirm" action={placeSwimmer}>
        <input type="hidden" name="studentId" value={swimmer.studentId} />
        <input type="hidden" name="courseId" value={pick.id} />
        <input type="hidden" name="at" value={at} />
        <h2 className="tc-confirm-t">Place {swimmer.firstName} in {pick.label}, {dayName(pick.day)} {pick.time}?</h2>
        <p className="tc-confirm-l">{[pick.where, pick.instructor, swimmer.site].filter(Boolean).join(" · ")}</p>
        <p className="tc-confirm-l">Their place starts today. Billing is marked as still to confirm in Legend. Nothing changes until you confirm.</p>
        <div className="tc-actions">
          <button className="tc-prominent tc-prominent-auto" type="submit">Place {swimmer.firstName}</button>
          <Link className="tc-soft" href={`/place?at=${at}`}>Choose another class</Link>
        </div>
      </form>
    );
  }
  if (swimmer.classes.length === 0) {
    return <p className="tc-note">No {swimmer.level ?? ""} class at {swimmer.site ?? "this site"} has a free place right now. Ring the family, then note what was agreed.</p>;
  }
  return (
    <div className="tc-classes">
      {swimmer.classes.map((c) => (
        <Link key={c.id} className="tc-class" href={`/place?at=${at}&pick=${encodeURIComponent(c.id)}`}>
          <span className="tc-class-day">{dayName(c.day)}</span>
          <span className="tc-class-time">{c.time}</span>
          <span className="tc-class-where">{[c.where, c.instructor].filter(Boolean).join(" · ")}</span>
          <span className="tc-class-free">{freeLine(c)}</span>
          <span className="tc-class-do" aria-hidden="true">Place</span>
        </Link>
      ))}
    </div>
  );
}

/** Place a swimmer: one at a time, longest wait first. Who to ring, and the classes at their
 *  level with a free place. */
export default async function PlacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requireGrant("desk");
  const params = await searchParams;
  const queue = await waitingFor(account);
  const at = Math.min(Math.max(0, Number.parseInt(one(params.at) ?? "0", 10) || 0), Math.max(0, queue.length - 1));
  const waiting = queue[at];
  const [swimmer, placed] = await Promise.all([
    waiting ? swimmerFor(account, waiting) : null,
    one(params.placed) ? placedSummary(account, one(params.placed)!) : null,
  ]);
  const refused = REFUSED[one(params.refused) ?? ""];
  const pick = swimmer?.classes.find((c) => c.id === one(params.pick));
  const followUp = inTurnfin("/awaiting-enrolment");

  return (
    <Frame account={account} current="/place" header={
      <div className="tc-head-row">
        <div>
          <div className="tc-eyebrow"><Link className="tc-back" href="/">‹ Home</Link></div>
          <h1 className="tc-title">Place a swimmer</h1>
          <p className="tc-meta">{queue.length === 0 ? "Nobody is waiting" : `${at + 1} of ${queue.length} waiting · longest wait first`}</p>
        </div>
        {queue.length > 1 ? (
          <Link className="tc-ground-button tc-ground-link" href={`/place?at=${at + 1 < queue.length ? at + 1 : 0}`}>
            {at + 1 < queue.length ? "Next swimmer" : "Back to the first"} <Arrow />
          </Link>
        ) : null}
      </div>
    }>
      {placed ? <div className="tc-done" role="status">Placed. {placed.name} is in {placed.label}, from today. Their billing is under Billing to confirm on Home.</div> : null}
      {refused ? <div className="tc-alert" role="alert">{refused}</div> : null}

      {!swimmer ? (
        <p className="tc-good">Everyone has a place. Nobody is waiting at your sites.</p>
      ) : (
        <>
          <div className="tc-who">
            <span className="tc-who-initials" aria-hidden="true">{initials(swimmer.name)}</span>
            <div className="tc-who-text">
              <h2 className="tc-who-name">{swimmer.name}</h2>
              <p className="tc-who-facts">{[swimmer.level, swimmer.age === null ? null : `age ${swimmer.age}`, waited(swimmer.days)].filter(Boolean).join(" · ")}</p>
            </div>
            {swimmer.contact ? (
              <a className="tc-ring" href={`tel:${swimmer.contact.phone.replace(/[^\d+]/g, "")}`}>
                <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                </svg>
                <span>
                  <span className="tc-ring-l">{swimmer.contact.name ? `Ring ${swimmer.contact.name}` : "Ring the family"}</span>
                  <span className="tc-ring-n">{swimmer.contact.phone}</span>
                </span>
              </a>
            ) : (
              <p className="tc-ring tc-ring-none">No phone number on their record</p>
            )}
          </div>

          {swimmer.waitingListOnly ? (
            <p className="tc-note">
              {swimmer.firstName} is on a class&apos;s waiting list, with no assessment to say which level to offer.
              {followUp ? <> <a href={followUp}>Open the waiting list in Turnfin</a> to move them into a place.</> : " Move them into a place in Turnfin."}
            </p>
          ) : (
            <>
              {pick ? null : <h2 className="tc-section tc-section-gap">{swimmer.level ?? "Classes"} classes with a free place <span className="tc-section-hint">tap one to place {swimmer.firstName}</span></h2>}
              <Classes swimmer={swimmer} at={at} pick={pick} />
              {pick || !followUp ? null : (
                <p className="tc-foot"><a className="tc-soft" href={followUp}>No class suits them: note it in Turnfin</a></p>
              )}
            </>
          )}
        </>
      )}
    </Frame>
  );
}
