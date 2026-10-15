"use client";

import { useRouter } from "next/navigation";
import { EmailCheck } from "@/components/email-check";
import { Frame } from "@/components/ui";

/** Signing in on its own, to see your bookings. Booking a course signs you in on its page. */
export default function SignInPage() {
  const router = useRouter();
  return (
    <Frame title="Sign in">
      <div className="stack-sm">
        <h1>Sign in</h1>
        <p className="lead">See the courses you have booked, your dates and what is left to pay.</p>
      </div>
      <section className="pc-panel narrow" aria-label="Sign in with your email">
        <EmailCheck onDone={() => router.replace("/bookings")} />
      </section>
    </Frame>
  );
}
