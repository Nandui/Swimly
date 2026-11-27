"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, undefined);
  return (
    <form action={action}>
      <p>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </p>
      <p>
        <label htmlFor="password">Password</label>
        <br />
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </p>
      {state?.error ? <p role="alert">{state.error}</p> : null}
      <p>
        <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </p>
    </form>
  );
}
