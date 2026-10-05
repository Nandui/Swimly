import Link from "next/link";
import { House } from "lucide-react";
import { Frame } from "@/components/frame";

/** An address that is not a Turnfin Me page: say so, and offer Home. */
export default function NotFound() {
  return (
    <Frame title="Page not found">
      <div className="stack">
        <div className="stack-sm"><h1>Page not found</h1><p className="muted">This page isn’t in Turnfin Me. The link may be old or mistyped.</p></div>
        <section className="pc-panel" aria-label="What next">
          <p>Your training, reading, shifts and everything else start from Home.</p>
          <Link href="/" className="button block"><House aria-hidden="true" />Go to Home</Link>
        </section>
      </div>
    </Frame>
  );
}
