import { signOut } from "@/access/actions";
import { GRANTS } from "@/access/grants";
import { requireAccount } from "@/access/session";
import { longDate } from "@/data/dates";
import { todaysClasses } from "@/today/data";

/** The first page: proof that a person signs in with their Turnfin account and reads today's classes from the
 *  existing tables. The real Today arrives with the design (docs/courses.md, steps 2 to 4). */
export default async function TodayPage() {
  const account = await requireAccount();
  const classes = await todaysClasses(account);
  return (
    <main>
      <h1>Today</h1>
      <p>{longDate()} · signed in as {account.name}</p>

      {classes === null ? (
        <p>Your role has nothing to open here yet. Ask an administrator to give your role Classes, Pool deck or Academy in Turnfin.</p>
      ) : classes.length === 0 ? (
        <p>No classes today.</p>
      ) : (
        <table>
          <caption>Swim classes today</caption>
          <thead>
            <tr><th scope="col">Time</th><th scope="col">Class</th><th scope="col">Site</th><th scope="col">Where</th><th scope="col">Instructor</th></tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}><td>{c.time}</td><td>{c.name}</td><td>{c.site}</td><td>{c.where}</td><td>{c.instructor}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>What you can do</h2>
      {account.access.grants.size === 0 ? <p>Nothing yet.</p> : (
        <ul>{[...account.access.grants].map((grant) => <li key={grant}>{GRANTS[grant]}</li>)}</ul>
      )}

      <form action={signOut}><button type="submit">Sign out</button></form>
    </main>
  );
}
