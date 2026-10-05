"use client";

import Link from "next/link";
import { House, RotateCw } from "lucide-react";
import { Frame } from "@/components/frame";
import { Notice } from "@/components/ui";

/** Something on the page broke while it was showing: try again, or start again from Home. */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Frame title="Something went wrong">
      <div className="stack">
        <h1>Something went wrong</h1>
        <Notice title="This page couldn't be shown" tone="error" live>Try again. If it keeps happening, go to Home and open it from there.</Notice>
        <div className="row">
          <button type="button" className="button" onClick={() => retry()}><RotateCw aria-hidden="true" />Try again</button>
          <Link href="/" className="button outline"><House aria-hidden="true" />Go to Home</Link>
        </div>
      </div>
    </Frame>
  );
}
