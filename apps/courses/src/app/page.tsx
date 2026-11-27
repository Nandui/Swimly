import { may } from "@/access/grants";
import { requireAccount } from "@/access/session";
import { hourIn, longDate } from "@/data/dates";
import { Find, Frame } from "@/frame/frame";
import { inTurnfin } from "@/frame/turnfin";
import { jobsFor, type Job } from "@/home/data";

function greeting(name: string): string {
  const hour = hourIn();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${name.split(/\s+/)[0] ?? name}`;
}

/** One job: a number and a plain verb, and the whole tile opens it. Until Courses has its own
 *  page for the job it opens in Turnfin, on the same records. */
function Tile({ job }: { job: Job }) {
  const href = inTurnfin(job.path);
  const body = (
    <>
      <span className="tc-tile-n">{job.count}</span>
      <span className="tc-tile-t">{job.title}</span>
      <span className="tc-tile-l">{job.count === 0 ? job.nothing : job.line}</span>
      {href ? (
        <svg className="tc-tile-go" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      ) : null}
    </>
  );
  const className = job.count === 0 ? "tc-tile tc-tile-0" : "tc-tile";
  return href ? <a className={className} href={href}>{body}</a> : <div className={className}>{body}</div>;
}

/** Home: find someone, then the jobs waiting for you. */
export default async function HomePage() {
  const account = await requireAccount();
  const jobs = await jobsFor(account);
  return (
    <Frame account={account} current="/" header={
      <>
        <div className="tc-eyebrow">{longDate()}</div>
        <h1 className="tc-greeting">{greeting(account.name)}</h1>
        {may(account.access, "desk") ? <Find /> : null}
      </>
    }>
      <h2 className="tc-sr">What needs doing</h2>
      {jobs.length === 0 ? (
        <p className="tc-note">Nothing here is yours to do yet. The pool deck and the other pages are on their way; until then, your classes are in Turnfin.</p>
      ) : (
        <div className="tc-tiles">{jobs.map((job) => <Tile key={job.key} job={job} />)}</div>
      )}
    </Frame>
  );
}
