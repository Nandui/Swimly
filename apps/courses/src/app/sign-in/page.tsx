import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/access/sign-in-form";
import { currentAccount } from "@/access/session";

export const metadata: Metadata = { title: "Sign in · Turnfin Courses" };

export default async function SignInPage() {
  if (await currentAccount()) redirect("/");
  return (
    <main>
      <h1>Turnfin Courses</h1>
      <p>Sign in with your Turnfin Courses account. It is separate from your Turnfin sign-in.</p>
      <SignInForm />
    </main>
  );
}
