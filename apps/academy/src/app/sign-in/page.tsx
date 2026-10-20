"use client";

import { useRouter } from "next/navigation";
import { EmailCheck } from "@/components/email-check";
import { Frame } from "@/components/ui";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";

/** Signing in on its own, to see your bookings. Booking a course signs you in on its page. */
export default function SignInPage() {
  const router = useRouter();
  return (
    <Frame title="Sign in">
      <PageShell spacing="roomy" header={<PageHeader title="Sign in" description="See the courses you have booked, your dates and what is left to pay." />}>
        <section className="pc-panel narrow" aria-label="Sign in with your email">
          <EmailCheck onDone={() => router.replace("/bookings")} />
        </section>
      </PageShell>
    </Frame>
  );
}
