import type { Metadata } from "next";
import { BadgeCheck, SearchX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatDate } from "@/lib/format";
import { checkCertificate } from "@/modules/training/features/compliance";

export const metadata: Metadata = { title: "Check a certificate" };

/** Checks the code on a certificate from Turnfin Me (e-learning phase 4): whose it is, which
 *  course and when it was finished. Shows nothing else about the person. */
export default async function CheckCertificatePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const result = code?.trim() ? await checkCertificate(code) : null;
  return (
    <>
      <PageHeader title="Check a certificate" description="Every certificate from Turnfin Me has a code at the bottom. Type it here to see that it is real." />
      <form method="get" className="pc-panel" role="search" aria-label="Check a certificate">
        <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 grow basis-60">
          <Input id="certificate-code" name="code" label="Certificate code" defaultValue={code ?? ""} placeholder="ABCD-EFGH-JKMN" autoComplete="off" spellCheck={false} maxLength={20} required />
        </div>
        <Button type="submit" className="min-h-11">Check</Button>
        </div>
      </form>
      {result ? result.found ? (
        <Notice tone={result.standing ? "success" : "warning"} title={result.standing ? "This certificate is real" : "This certificate no longer stands"} icon={BadgeCheck}>
          <p><strong>{result.name}</strong> finished <strong>{result.course}</strong>{result.completedAt ? ` on ${formatDate(result.completedAt)}` : ""}{result.signedOffBy ? `, signed off by ${result.signedOffBy}` : ""}.</p>
          <p className="tabular-nums">Code {result.code}</p>
        </Notice>
      ) : (
        <Notice tone="warning" title="No certificate has that code" icon={SearchX}>Check each letter and number. Codes never use the letters O, I or L, or the numbers 0 or 1.</Notice>
      ) : null}
    </>
  );
}
