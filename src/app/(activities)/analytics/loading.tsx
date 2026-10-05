import { PageLoading } from "@/components/ui-kit/page-loading";

/** A report opens with figure tiles, so its placeholder does too. */
export default function AnalyticsLoading() {
  return <PageLoading tiles />;
}
