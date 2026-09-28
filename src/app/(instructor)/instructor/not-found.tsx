import Link from "next/link";
import { Button } from "@/components/shadcn/button";

export default function NotFound() {
  return <div className="flex flex-col items-start gap-4 py-6">
    <h1 className="text-2xl font-semibold">Class unavailable</h1>
    <p className="text-ui-muted-foreground">This class could not be opened. Return to your classes and try again.</p>
    <Button asChild><Link href="/instructor">Back to classes</Link></Button>
  </div>;
}
