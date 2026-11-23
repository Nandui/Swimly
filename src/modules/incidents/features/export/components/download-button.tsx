import { Download } from "lucide-react";
import { Button } from "@/components/shadcn/button";

/** Downloads the full record as a PDF file, laid out as a document to send. */
export function DownloadButton({ id }: { id: string }) {
  return <Button asChild variant="outline" className="min-h-11"><a href={`/api/incidents/export/${id}`} download><Download aria-hidden="true" />Download PDF</a></Button>;
}
