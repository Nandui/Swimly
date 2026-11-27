"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, undefined);
  return (
    <form action={action}>
      <label className="tc-field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="tc-field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error ? <div className="tc-alert" role="alert">{state.error}</div> : null}
      <button className="tc-prominent" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
