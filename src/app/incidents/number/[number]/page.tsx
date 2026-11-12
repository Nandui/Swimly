import { redirect } from "next/navigation";
import { reportIdByNumber } from "@/modules/incidents/features/reports";

/** /incidents/number/42 opens INC-00042, for links that only know the number (the CCTV log). */
export default async function IncidentByNumberPage({ params }: { params: Promise<{ number: string }> }) {
  redirect(`/incidents/${await reportIdByNumber(Number((await params).number))}`);
}
