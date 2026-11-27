import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { continueWithTurnfin } from "@/access/actions";
import { turnfinConfig } from "@/access/pass";
import { SignInForm } from "@/access/sign-in-form";
import { currentAccount } from "@/access/session";

export const metadata: Metadata = { title: "Sign in · Turnfin Courses" };

/** Staff keep their Turnfin logins (docs/courses.md): one button to Turnfin and back. The
 *  email and password form is only for running Courses without Turnfin beside it. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; out?: string }> }) {
  if (await currentAccount()) redirect("/");
  const { error, out } = await searchParams;
  const turnfin = turnfinConfig();
  return (
    <main>
      <h1>Turnfin Courses</h1>
      {out ? <p role="status">You are signed out of Turnfin Courses. You may still be signed in to Turnfin.</p> : null}
      {error ? <p role="alert">Could not sign you in from Turnfin. Try again.</p> : null}
      {turnfin ? (
        <>
          <p>Use the sign-in you already have. If you are signed in to Turnfin, there is nothing to type.</p>
          <form action={continueWithTurnfin}>
            <button type="submit">Continue with Turnfin</button>
          </form>
        </>
      ) : (
        <>
          <p>Sign in with your Turnfin email and password.</p>
          <SignInForm />
        </>
      )}
    </main>
  );
}
