"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { EmailCheck } from "@/components/email-check";
import { Frame } from "@/components/ui";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import pool from "../../../public/images/pool-water.webp";

/** Signing in on its own, to see your bookings. Booking a course signs you in on its page. */
export default function SignInPage() {
  const router = useRouter();
  return (
    <Frame title="Sign in" wide>
      <div className="auth-layout">
        <PageShell spacing="roomy" header={<PageHeader title="Sign in" description="See the courses you have booked, your dates and what is left to pay." />}>
          <section aria-label="Sign in with your email">
            <EmailCheck onDone={() => router.replace("/bookings")} />
          </section>
        </PageShell>
        <figure className="auth-photo">
          <Image src={pool} alt="" />
          <figcaption><LifeBuoy aria-hidden="true" /><span>Lifeguard and swim teacher courses<br /><strong>at LeisureWorld</strong></span></figcaption>
        </figure>
      </div>
    </Frame>
  );
}
