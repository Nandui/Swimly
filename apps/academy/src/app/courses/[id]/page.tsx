"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award, CalendarDays, ChevronLeft, ClipboardCheck, Clock, MapPin, Send, Wallet } from "lucide-react";
import { ApiError, api, checked, type Course } from "@/lib/api";
import { day, placesMeta } from "@/lib/format";
import { Frame, Loading, Notice, Tag } from "@/components/ui";

type Step = "email" | "code" | "details" | "done";
type Held = { reference: string; callByLabel: string; phone: string; course: { name: string; site: string; starts: string } };
const TIMES = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]] as const;
const message = (e: unknown) => (e instanceof ApiError ? e.message : "Could not complete that. Try again.");

/** One course and holding a place on it: check your email with a code, give the details we need to
 *  phone you, and the place is held. Payment is taken by phone within 72 hours. */
export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<Held | null>(null);

  useEffect(() => {
    let live = true;
    api<{ course: Course }>(`courses/${encodeURIComponent(id)}`)
      .then((r) => { if (!live) return; setCourse(r.course); const c = checked.get(); if (c) { setEmail(c.email); setStep("details"); } })
      .catch((e) => { if (live) setLoadError(message(e)); });
    return () => { live = false; };
  }, [id]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const sendCode = (event: FormEvent) => { event.preventDefault(); return run(async () => {
    const r = await api<{ challengeId: string }>("auth/request-code", { method: "POST", body: { email } });
    setChallenge(r.challengeId); setCode(""); setStep("code");
  }); };
  const verify = (event: FormEvent) => { event.preventDefault(); return run(async () => {
    const r = await api<{ token: string; email: string; expiresAt: string }>("auth/verify-code", { method: "POST", body: { challengeId: challenge, code } });
    checked.set(r); setStep("details");
  }); };
  const hold = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    return run(async () => {
      const token = checked.get()?.token;
      if (!token) { setStep("email"); throw new ApiError(401, "UNAUTHENTICATED", "Your email check has expired. Ask for a new code."); }
      const r = await api<Held>("bookings", { method: "POST", token, body: {
        courseId: id, name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? ""), phone2: String(fd.get("phone2") ?? ""),
        dateOfBirth: String(fd.get("dob") ?? ""), callTimes: fd.getAll("callTimes").map(String), note: String(fd.get("note") ?? ""),
      } });
      setHeld(r); setStep("done"); window.scrollTo(0, 0);
    });
  };

  if (loadError) return <Frame title="Course"><BackLink /><Notice title="This course is not open for booking" tone="warning">{loadError}</Notice></Frame>;
  if (!course) return <Frame title="Course"><BackLink /><Loading rows={2} /></Frame>;

  if (step === "done" && held) {
    return (
      <Frame title="Place held">
        <Tag meta={{ label: "Waiting for payment", tone: "orange", icon: Clock }} />
        <div className="stack-sm" role="status">
          <h1>Your place is held</h1>
          <p className="muted">We will phone you on {held.phone} by {held.callByLabel} to take payment of {course.price}. Your place is confirmed once you have paid.</p>
        </div>
        <section className="pc-panel" aria-label="Your booking">
          <dl className="summary">
            <div><dt>Course</dt><dd>{held.course.name}</dd></div>
            <div><dt>Starts</dt><dd>{held.course.starts}, {held.course.site}</dd></div>
            <div><dt>Reference</dt><dd className="tabular">{held.reference}</dd></div>
          </dl>
        </section>
        <p className="muted">We emailed you these details. If we can&apos;t reach you within 72 hours, we may give the place to someone else. To change your number, reply to the email.</p>
        <Link href="/" className="button outline block">See other courses</Link>
      </Frame>
    );
  }

  const full = course.placesLeft <= 0;
  return (
    <Frame title={course.name}>
      <BackLink />
      <div className="stack-sm">
        <h1>{course.name}</h1>
        <div className="row"><Tag meta={placesMeta(course.placesLeft)} /><span className="muted">{course.kindLabel}</span></div>
      </div>
      <section className="pc-panel" aria-label="About the course">
        <ul className="facts">
          <li><CalendarDays aria-hidden="true" /><span>{course.sessions.map((s) => `${day(s.date)}, ${s.start} to ${s.end}`).join("; ")}</span></li>
          <li><MapPin aria-hidden="true" /><span>{[course.site, ...new Set(course.sessions.map((s) => s.place).filter(Boolean))].join(", ")}</span></li>
          {course.awardingBody || course.minAge ? <li><Award aria-hidden="true" /><span>{[course.awardingBody ? `Awarded by ${course.awardingBody}.` : null, course.minAge && course.firstDay ? `You must be ${course.minAge} or over on ${day(course.firstDay)}.` : null].filter(Boolean).join(" ")}</span></li> : null}
          {course.checks.length ? <li><ClipboardCheck aria-hidden="true" /><span>Before the course: {course.checks.map((c) => c.charAt(0).toLowerCase() + c.slice(1)).join(", ")}</span></li> : null}
          <li><Wallet aria-hidden="true" /><span>{course.priceCents ? `${course.price}, paid by phone.` : "Free."}</span></li>
        </ul>
      </section>

      {full ? <Notice title="This course is full" tone="warning">Have a look at the other courses.</Notice> : (
        <section className="pc-panel" aria-labelledby="book-h">
          <div className="stack-sm">
            <h2 id="book-h">{step === "details" ? "Your details" : "Book a place"}</h2>
            <p className="muted">
              {step === "email" ? "We send a code to your email to check it is yours." : step === "code" ? `We sent a six-digit code to ${email}. It works for 10 minutes. Not there? Check your junk folder.` : `Booking as ${email}.`}
            </p>
          </div>
          {error ? <Notice title={error} tone="error" live /> : null}
          {step === "email" ? (
            <form key="email" className="stack" onSubmit={sendCode}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" className="button block" disabled={busy}><Send aria-hidden="true" />{busy ? "Sending…" : "Send me a code"}</button>
            </form>
          ) : step === "code" ? (
            <form key="code" className="stack" onSubmit={verify}>
              <div className="field">
                <label htmlFor="code">Six-digit code</label>
                <input id="code" className="input tabular" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </div>
              <button type="submit" className="button block" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</button>
              <button type="button" className="button ghost block" onClick={() => { setStep("email"); setError(null); }}><ChevronLeft aria-hidden="true" />Use a different email</button>
            </form>
          ) : (
            <form key="details" className="stack" onSubmit={hold}>
              <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" className="input" autoComplete="name" required minLength={2} maxLength={80} /></div>
              <div className="field">
                <label htmlFor="phone">Mobile number</label>
                <input id="phone" name="phone" className="input" type="tel" autoComplete="tel" required maxLength={30} aria-describedby="phone-hint" />
                <span id="phone-hint" className="hint">We phone this number to take payment.</span>
              </div>
              <div className="field"><label htmlFor="phone2">Another number <span className="muted">(optional)</span></label><input id="phone2" name="phone2" className="input" type="tel" maxLength={30} /></div>
              <div className="field">
                <label htmlFor="dob">Date of birth</label>
                <input id="dob" name="dob" className="input" type="date" required autoComplete="bday" aria-describedby={course.minAge ? "dob-hint" : undefined} />
                {course.minAge && course.firstDay ? <span id="dob-hint" className="hint">You must be {course.minAge} or over on {day(course.firstDay)}.</span> : null}
              </div>
              <fieldset className="field">
                <legend>Best time to phone you</legend>
                <div className="chips">
                  {TIMES.map(([value, label]) => <label key={value} className="chip"><input type="checkbox" name="callTimes" value={value} />{label}</label>)}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="note">Anything we should know <span className="muted">(optional)</span></label>
                <textarea id="note" name="note" className="input" maxLength={500} aria-describedby="note-hint" />
                <span id="note-hint" className="hint">Please don&apos;t include medical details. We ask for those on the medical form.</span>
              </div>
              <Notice title="What happens next">We hold your place and phone you within 72 hours to take payment{course.priceCents ? ` of ${course.price}` : ""}. Your place is confirmed once you have paid.</Notice>
              <button type="submit" className="button block" disabled={busy}>{busy ? "Holding your place…" : "Hold my place"}</button>
            </form>
          )}
        </section>
      )}
    </Frame>
  );
}

function BackLink() {
  return <Link href="/" className="button ghost back-link"><ChevronLeft aria-hidden="true" />All courses</Link>;
}
