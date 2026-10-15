"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award, CalendarDays, ChevronLeft, ClipboardCheck, Clock, Hourglass, LogOut, MapPin, Wallet } from "lucide-react";
import { ApiError, api, message, signOut, type Course, type Hold } from "@/lib/api";
import { day, longDay, placesMeta, rhythm, span } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { EmailCheck } from "@/components/email-check";
import { Frame, Loading, Notice, Tag } from "@/components/ui";

const TIMES = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]] as const;

/** One course, and booking it: sign in with an email code (once a week on this browser), give the
 *  details we need to phone you, and the place is held. Payment is taken by phone within 72
 *  hours. A full short course offers its waiting list instead. */
export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const who = useSession();
  const [course, setCourse] = useState<Course | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<Hold | null>(null);

  useEffect(() => {
    let live = true;
    api<{ course: Course }>(`courses/${encodeURIComponent(id)}`)
      .then((r) => { if (live) setCourse(r.course); })
      .catch((e) => { if (live) setLoadError(message(e)); });
    return () => { live = false; };
  }, [id]);

  const full = !!course && course.placesLeft <= 0;
  const hold = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    api<Hold>("bookings", { method: "POST", auth: true, body: {
      courseId: id, name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? ""), phone2: String(fd.get("phone2") ?? ""),
      dateOfBirth: String(fd.get("dob") ?? ""), callTimes: fd.getAll("callTimes").map(String), note: String(fd.get("note") ?? ""), waitingList: full,
    } })
      .then((r) => { setHeld(r); window.scrollTo(0, 0); })
      .catch((e) => {
        setError(message(e));
        // The last place went while they were typing: show the course as it is now.
        if (e instanceof ApiError && e.code === "FULL") api<{ course: Course }>(`courses/${encodeURIComponent(id)}`).then((r) => setCourse(r.course)).catch(() => {});
      })
      .finally(() => setBusy(false));
  };

  if (loadError) return <Frame title="Course"><BackLink /><Notice title="This course is not open for booking" tone="warning">{loadError}</Notice></Frame>;
  if (!course) return <Frame title="Course" wide><BackLink /><Loading rows={2} /></Frame>;
  if (held) return <Done held={held} course={course} />;

  const places = [...new Set(course.sessions.map((s) => s.place).filter(Boolean))];
  const closed = full && !course.waitingList;
  return (
    <Frame title={course.name} wide>
      <BackLink />
      <div className="course-layout">
        <div className="stack course-info">
          <div className="stack-sm">
            <p className="caption">{course.group === "qualification" ? `${course.categoryLabel} qualification` : course.categoryLabel}</p>
            <h1>{course.name}</h1>
            {course.description ? <p className="lead">{course.description}</p> : null}
          </div>
          <section className="pc-panel" aria-label="About the course">
            <ul className="facts">
              <li><CalendarDays aria-hidden="true" /><span><strong>{span(course.firstDay, course.lastDay)}</strong><br /><span className="muted">{rhythm(course)}</span></span></li>
              <li><MapPin aria-hidden="true" /><span>{[course.site, ...places].join(", ")}</span></li>
              {course.awardingBody || course.minAge ? <li><Award aria-hidden="true" /><span>{[course.awardingBody ? `Awarded by ${course.awardingBody}.` : null, course.minAge && course.firstDay ? `You must be ${course.minAge} or over on ${day(course.firstDay)}.` : null].filter(Boolean).join(" ")}</span></li> : null}
              {course.checks.length ? <li><ClipboardCheck aria-hidden="true" /><span>Before you start: {course.checks.map((c) => c.charAt(0).toLowerCase() + c.slice(1)).join(", ")}. We tell you how when we phone.</span></li> : null}
              <li><Wallet aria-hidden="true" /><span>{course.priceCents ? `${course.price} for the whole course, paid by phone after you book.` : "Free."}</span></li>
            </ul>
          </section>
        </div>
        {course.sessions.length > 1 ? (
            <section className="pc-panel course-dates" aria-labelledby="dates-h">
              <h2 id="dates-h">Dates</h2>
              <ol className="dates">
                {course.sessions.map((s) => (
                  <li key={`${s.date}-${s.start}`}><span>{longDay(s.date)}</span><span className="muted tabular">{s.start} to {s.end}{s.place && places.length > 1 ? `, ${s.place}` : ""}</span></li>
                ))}
              </ol>
            </section>
          ) : null}

        <aside className="pc-panel book-panel" aria-labelledby="book-h">
          <div className="stack-sm">
            <p className="price large">{course.price}</p>
            <Tag meta={placesMeta(course)} />
          </div>
          <h2 id="book-h">{closed ? "This course is full" : full ? "Join the waiting list" : "Book a place"}</h2>
          {closed ? <p className="muted">Have a look at the other courses. New dates are added as they are set.</p>
          : who === undefined ? <Loading rows={1} />
          : !who ? <EmailCheck onDone={() => setError(null)} lead={full ? "Sign in with your email to join the waiting list. We send you a code; no password needed." : "Sign in with your email to book. We send you a code; no password needed."} />
          : (
            <form className="stack" onSubmit={hold}>
              <p className="muted signed-in">Booking as {who.email}. <button type="button" className="link-button" onClick={() => void signOut()}><LogOut aria-hidden="true" />Not you?</button></p>
              {error ? <Notice title={error} tone="error" live /> : null}
              <div className="field"><label htmlFor="name">Full name of the person taking the course</label><input id="name" name="name" className="input" autoComplete="name" required minLength={2} maxLength={80} /></div>
              <div className="field">
                <label htmlFor="phone">Mobile number</label>
                <input id="phone" name="phone" className="input" type="tel" autoComplete="tel" required maxLength={30} aria-describedby="phone-hint" />
                <span id="phone-hint" className="hint">{full ? "We phone this number if a place comes up." : "We phone this number to take payment."}</span>
              </div>
              <div className="field"><label htmlFor="phone2">Another number <span className="muted">(optional)</span></label><input id="phone2" name="phone2" className="input" type="tel" maxLength={30} /></div>
              {course.askDateOfBirth ? (
                <div className="field">
                  <label htmlFor="dob">Date of birth</label>
                  <input id="dob" name="dob" className="input" type="date" required autoComplete="bday" aria-describedby={course.minAge ? "dob-hint" : undefined} />
                  {course.minAge && course.firstDay ? <span id="dob-hint" className="hint">You must be {course.minAge} or over on {day(course.firstDay)}.</span> : null}
                </div>
              ) : null}
              <fieldset className="field">
                <legend>Best time to phone you</legend>
                <div className="chips">
                  {TIMES.map(([value, label]) => <label key={value} className="chip"><input type="checkbox" name="callTimes" value={value} />{label}</label>)}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="note">Anything we should know <span className="muted">(optional)</span></label>
                <textarea id="note" name="note" className="input" maxLength={500} aria-describedby="note-hint" />
                <span id="note-hint" className="hint">Please don&apos;t include medical details. We ask for those separately.</span>
              </div>
              <Notice title="What happens next">{full
                ? "You join the waiting list in the order you signed up. If a place comes up, we phone you to offer it and take payment."
                : `We hold your place and phone you within 72 hours to take payment${course.priceCents ? ` of ${course.price}` : ""}. Your place is confirmed once you have paid.`}</Notice>
              <button type="submit" className="button large stretch" disabled={busy}>{busy ? "Sending…" : full ? <><Hourglass aria-hidden="true" />Join the waiting list</> : "Hold my place"}</button>
            </form>
          )}
        </aside>
      </div>
    </Frame>
  );
}

function Done({ held, course }: { held: Hold; course: Course }) {
  const waiting = held.outcome === "waiting";
  return (
    <Frame title={waiting ? "On the waiting list" : "Place held"}>
      <Tag meta={waiting ? { label: "Waiting list", tone: "blue", icon: Hourglass } : { label: "Waiting for payment", tone: "orange", icon: Clock }} />
      <div className="stack-sm" role="status">
        <h1>{waiting ? "You're on the waiting list" : "Your place is held"}</h1>
        <p className="lead">{waiting
          ? `If a place comes up on ${held.course.name}, we will phone you on ${held.phone} to offer it.`
          : `We will phone you on ${held.phone} by ${held.callByLabel} to take payment of ${course.price}. Your place is confirmed once you have paid.`}</p>
      </div>
      <section className="pc-panel" aria-label="Your booking">
        <dl className="summary">
          <div><dt>Course</dt><dd>{held.course.name}</dd></div>
          <div><dt>Starts</dt><dd>{held.course.starts}, {held.course.site}</dd></div>
          <div><dt>Reference</dt><dd className="tabular">{held.reference}</dd></div>
        </dl>
      </section>
      <p className="muted">We emailed you these details. {waiting ? "" : "If we can't reach you within 72 hours, we may give the place to someone else. "}To change your number, reply to the email.</p>
      <div className="row">
        <Link href="/bookings" className="button">See my bookings</Link>
        <Link href="/" className="button outline">Other courses</Link>
      </div>
    </Frame>
  );
}

function BackLink() {
  return <Link href="/" className="button ghost back-link"><ChevronLeft aria-hidden="true" />All courses</Link>;
}
