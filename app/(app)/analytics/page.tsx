import { auth } from "@/auth";
import { getExecutionAnalytics } from "@/lib/metrics";
import { AnalyticsClient } from "@/components/analytics/analytics-client";

export default async function AnalyticsPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const analytics = await getExecutionAnalytics(userId, 8);

  return <AnalyticsClient analytics={analytics} />;
}
